// server/routes/creatorsConversao.ts
// Tela auxiliar: clientes pontuais de Creators que viraram recorrentes.
// Spec: docs/superpowers/specs/2026-07-03-creators-conversao-design.md
import type { Express } from "express";
import { sql } from "drizzle-orm";

const PERIODO_RE = /^\d{4}-\d{2}$/;

/** Primeiro dia do mês seguinte a um 'YYYY-MM' (limite exclusivo do período). */
function inicioMesSeguinte(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

export function registerCreatorsConversaoRoutes(app: Express, db: any) {
  app.get("/api/creators-conversao", async (req, res) => {
    const de = (req.query.de as string) || "2026-01";
    const ate = (req.query.ate as string) || "2026-06";
    if (!PERIODO_RE.test(de) || !PERIODO_RE.test(ate)) {
      return res.status(400).json({ error: "Período inválido: use de/ate no formato YYYY-MM" });
    }
    const deDate = `${de}-01`;
    const ateDate = inicioMesSeguinte(ate);

    try {
      // Convertidos: clientes com pontual de Creators criado no período cujo
      // PRIMEIRO recorrente (qualquer produto) veio depois do primeiro pontual.
      // Cliente que já era recorrente antes não conta (primeiro_rec < primeiro_pontual).
      const convertidos = (await db.execute(sql`
        WITH pontual AS (
          SELECT c.id_task,
                 MIN(c.data_criado::date) AS primeiro_pontual,
                 COUNT(*)::int AS n_pontuais,
                 SUM(c.valorp::numeric) AS valor_pontual
          FROM "Clickup".cup_contratos c
          WHERE (c.produto ILIKE '%creator%' OR c.servico ILIKE '%creator%')
            AND c.valorp > 0
            AND c.data_criado >= ${deDate} AND c.data_criado < ${ateDate}
          GROUP BY c.id_task
        ),
        rec AS (
          SELECT c.id_task,
                 MIN(c.data_criado::date) AS primeiro_rec,
                 BOOL_OR(c.produto ILIKE '%creator%' OR c.servico ILIKE '%creator%') AS rec_em_creators,
                 SUM(c.valorr::numeric) AS mrr,
                 STRING_AGG(DISTINCT c.servico, ' | ') AS servicos_rec
          FROM "Clickup".cup_contratos c
          WHERE c.valorr > 0
          GROUP BY c.id_task
        )
        SELECT p.id_task, cl.nome, p.n_pontuais, p.valor_pontual,
               to_char(p.primeiro_pontual, 'YYYY-MM-DD') AS primeiro_pontual,
               to_char(r.primeiro_rec, 'YYYY-MM-DD') AS primeiro_rec,
               (r.primeiro_rec - p.primeiro_pontual)::int AS dias_ate_converter,
               r.mrr, r.servicos_rec, r.rec_em_creators
        FROM pontual p
        JOIN rec r ON r.id_task = p.id_task AND r.primeiro_rec > p.primeiro_pontual
        LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = p.id_task
        ORDER BY r.primeiro_rec DESC
      `)).rows as any[];

      const totalRow = (await db.execute(sql`
        SELECT COUNT(*)::int AS total FROM (
          SELECT c.id_task
          FROM "Clickup".cup_contratos c
          WHERE (c.produto ILIKE '%creator%' OR c.servico ILIKE '%creator%')
            AND c.valorp > 0
            AND c.data_criado >= ${deDate} AND c.data_criado < ${ateDate}
          GROUP BY c.id_task
        ) t
      `)).rows as any[];

      const totalPontuais = Number(totalRow[0]?.total ?? 0);
      const clientes = convertidos.map((r) => ({
        idTask: r.id_task,
        nome: r.nome ?? null,
        nPontuais: Number(r.n_pontuais ?? 0),
        valorPontual: Number(r.valor_pontual ?? 0),
        primeiroPontual: r.primeiro_pontual,
        primeiroRecorrente: r.primeiro_rec,
        diasAteConverter: Number(r.dias_ate_converter ?? 0),
        mrr: Number(r.mrr ?? 0),
        servicosRecorrentes: r.servicos_rec ?? "",
        recEmCreators: !!r.rec_em_creators,
      }));

      res.json({
        resumo: {
          totalPontuais,
          convertidos: clientes.length,
          convertidosCreators: clientes.filter((c) => c.recEmCreators).length,
          taxa: totalPontuais > 0 ? clientes.length / totalPontuais : 0,
        },
        clientes,
      });
    } catch (error) {
      console.error("[api] Error fetching creators-conversao:", error);
      res.status(500).json({ error: "Failed to fetch creators-conversao" });
    }
  });
}

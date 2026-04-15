import type { Express } from "express";
import { sql } from "drizzle-orm";
import type { IStorage } from "../storage";

export function registerReceitaRecorrenteRoutes(app: Express, db: any, storage: IStorage) {
  app.get("/api/financeiro/receita-recorrente/resumo", async (req, res) => {
    try {
      // Parâmetros com defaults (6 meses: 5m atrás até 2m à frente)
      const now = new Date();
      const defaultIni = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const defaultFim = new Date(now.getFullYear(), now.getMonth() + 2, 1);
      const dataIni = (req.query.data_ini as string) || defaultIni.toISOString().slice(0, 10);
      const dataFim = (req.query.data_fim as string) || defaultFim.toISOString().slice(0, 10);
      const empresaFiltro = (req.query.empresa as string) || null;

      const empresaClause = empresaFiltro
        ? sql` AND p.empresa = ${empresaFiltro}`
        : sql``;

      // Query principal com 3-case split
      const mesesResult = await db.execute(sql`
        WITH classified AS (
          SELECT
            p.id,
            p.empresa,
            DATE_TRUNC('month', COALESCE(p.data_competencia, p.data_vencimento))::date AS mes,
            p.valor_bruto,
            p.status,
            p.centro_custo_nome,
            p.valor_centro_custo,
            CASE
              WHEN p.centro_custo_nome ILIKE '%recorrente%' AND p.centro_custo_nome ILIKE '%pontual%' THEN 'MISTO'
              WHEN p.centro_custo_nome ILIKE '%recorrente%' THEN 'RECORRENTE'
              WHEN p.centro_custo_nome ILIKE '%pontual%' THEN 'PONTUAL'
              ELSE 'NAO_CLASSIFICADO'
            END AS classe
          FROM "Conta Azul".caz_parcelas p
          WHERE p.tipo_evento = 'RECEITA'
            AND COALESCE(p.data_competencia, p.data_vencimento) >= ${dataIni}::date
            AND COALESCE(p.data_competencia, p.data_vencimento) < ${dataFim}::date
            AND COALESCE(p.status, '') <> 'CANCELADO'
            AND COALESCE(p.categoria_nome, '') NOT LIKE '04.%'
            ${empresaClause}
        ),
        simples AS (
          SELECT
            empresa, mes, classe AS tipo,
            SUM(valor_bruto) AS previsto,
            SUM(valor_bruto) FILTER (WHERE status IN ('PAGO','QUITADO')) AS realizado
          FROM classified
          WHERE classe <> 'MISTO'
          GROUP BY 1, 2, 3
        ),
        mistos AS (
          SELECT
            c.empresa, c.mes,
            CASE
              WHEN nome_i ILIKE '%recorrente%' THEN 'RECORRENTE'
              WHEN nome_i ILIKE '%pontual%' THEN 'PONTUAL'
              ELSE 'NAO_CLASSIFICADO'
            END AS tipo,
            SUM(COALESCE(NULLIF(TRIM(valor_i), '')::numeric, 0)) AS previsto,
            SUM(
              CASE WHEN c.status IN ('PAGO','QUITADO')
                   THEN COALESCE(NULLIF(TRIM(valor_i), '')::numeric, 0)
                   ELSE 0 END
            ) AS realizado
          FROM classified c,
               unnest(
                 string_to_array(c.centro_custo_nome, ';'),
                 string_to_array(c.valor_centro_custo, ';')
               ) WITH ORDINALITY AS t(nome_i, valor_i, pos)
          WHERE c.classe = 'MISTO'
          GROUP BY 1, 2, 3
        ),
        consolidado AS (
          SELECT empresa, mes, tipo,
                 SUM(previsto) AS previsto,
                 SUM(realizado) AS realizado
          FROM (SELECT * FROM simples UNION ALL SELECT * FROM mistos) u
          GROUP BY 1, 2, 3
        )
        SELECT
          empresa::text AS empresa,
          mes::text AS mes,
          tipo::text AS tipo,
          COALESCE(previsto, 0)::float AS previsto,
          COALESCE(realizado, 0)::float AS realizado
        FROM consolidado
        ORDER BY empresa, mes, tipo;
      `);

      // Cobertura CC por mês × empresa
      const coberturaResult = await db.execute(sql`
        SELECT
          p.empresa::text AS empresa,
          DATE_TRUNC('month', COALESCE(p.data_competencia, p.data_vencimento))::date::text AS mes,
          (SUM(p.valor_bruto) FILTER (WHERE p.centro_custo_nome IS NOT NULL AND p.centro_custo_nome <> ''))::float AS com_cc,
          SUM(p.valor_bruto)::float AS total
        FROM "Conta Azul".caz_parcelas p
        WHERE p.tipo_evento = 'RECEITA'
          AND COALESCE(p.data_competencia, p.data_vencimento) >= ${dataIni}::date
          AND COALESCE(p.data_competencia, p.data_vencimento) < ${dataFim}::date
          AND COALESCE(p.status, '') <> 'CANCELADO'
          AND COALESCE(p.categoria_nome, '') NOT LIKE '04.%'
          ${empresaClause}
        GROUP BY 1, 2
      `);

      // MRR contratado (snapshot atual)
      const mrrContratadoResult = await db.execute(sql`
        SELECT COALESCE(SUM(valorr)::float, 0) AS total
        FROM "Clickup".cup_contratos
        WHERE status IN ('ativo', 'entregue', 'em cancelamento', 'pausado')
          AND valorr > 0
      `);
      const mrrContratado = (mrrContratadoResult.rows[0] as any)?.total || 0;

      // Mapa de cobertura
      const coberturaMap = new Map<string, number>();
      for (const row of coberturaResult.rows as any[]) {
        const key = `${row.empresa}|${row.mes}`;
        const com = row.com_cc || 0;
        const tot = row.total || 0;
        const pct = tot > 0 ? (com / tot) * 100 : 0;
        coberturaMap.set(key, pct);
      }

      // Agrupa resultado por mês × empresa.
      // Compara meses como strings ISO ("YYYY-MM-01") para evitar
      // ambiguidades de timezone entre o Date local do Node e o mes::text do Postgres.
      const mesMap = new Map<string, any>();
      const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

      for (const row of mesesResult.rows as any[]) {
        const key = `${row.empresa}|${row.mes}`;
        if (!mesMap.has(key)) {
          mesMap.set(key, {
            mes: row.mes,
            empresa: row.empresa,
            recorrente_previsto: 0,
            recorrente_realizado: 0,
            pontual_previsto: 0,
            pontual_realizado: 0,
            nao_classif_previsto: 0,
            nao_classif_realizado: 0,
            total_previsto: 0,
            total_realizado: 0,
            cobertura_cc_pct: coberturaMap.get(key) ?? 0,
            mrr_contratado: mrrContratado,
            is_futuro: row.mes > currentMonthStr,
          });
        }
        const entry = mesMap.get(key);
        const prev = row.previsto || 0;
        const real = row.realizado || 0;
        if (row.tipo === 'RECORRENTE') {
          entry.recorrente_previsto += prev;
          entry.recorrente_realizado += real;
        } else if (row.tipo === 'PONTUAL') {
          entry.pontual_previsto += prev;
          entry.pontual_realizado += real;
        } else {
          entry.nao_classif_previsto += prev;
          entry.nao_classif_realizado += real;
        }
        entry.total_previsto += prev;
        entry.total_realizado += real;
      }

      const meses = Array.from(mesMap.values()).sort((a, b) => {
        if (a.empresa !== b.empresa) return a.empresa.localeCompare(b.empresa);
        return a.mes.localeCompare(b.mes);
      });

      res.json({
        meses,
        cards: {
          mrr_recorrente_atual: 0,
          mrr_recorrente_delta_pct: 0,
          pontual_atual: 0,
          pontual_delta_pct: 0,
          mix_recorrente_pct: 0,
          realizado_pct: 0,
          gap_contratado: null,
          ticket_medio_recorrente: 0,
          novos_recorrente: 0,
          churned_recorrente: 0,
        },
        range: { data_ini: dataIni, data_fim: dataFim },
        empresa_filtro: empresaFiltro,
      });
    } catch (error: any) {
      console.error("[api] Error fetching receita-recorrente/resumo:", error);
      res.status(500).json({ error: error.message || "Failed to fetch resumo" });
    }
  });

  app.get("/api/financeiro/receita-recorrente/drilldown", async (req, res) => {
    try {
      res.json([]);
    } catch (error: any) {
      console.error("[api] Error fetching receita-recorrente/drilldown:", error);
      res.status(500).json({ error: error.message || "Failed to fetch drilldown" });
    }
  });
}

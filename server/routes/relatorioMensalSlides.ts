import type { Express } from "express";
import { sql } from "drizzle-orm";
import { objectives, krs } from "../okr2026/okrRegistry";

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export function registerRelatorioMensalSlidesRoutes(app: Express, db: any) {

  app.get("/api/reports/mensal", async (req, res) => {
    try {
      const mesParam = req.query.mes as string; // YYYY-MM
      if (!mesParam || !/^\d{4}-\d{2}$/.test(mesParam)) {
        return res.status(400).json({ error: "Parâmetro 'mes' inválido. Use formato YYYY-MM." });
      }

      const [anoStr, mesStr] = mesParam.split("-");
      const ano = parseInt(anoStr);
      const mes = parseInt(mesStr);
      const mesLabel = `${MESES_PT[mes - 1]} ${ano}`; // Label do reporte (ex: "Março 2026")

      // O mês selecionado é o mês do reporte (apresentação).
      // Todos os dados são do mês ANTERIOR (o mês de referência dos dados).
      const mesDados = mes === 1 ? 12 : mes - 1;
      const anoDados = mes === 1 ? ano - 1 : ano;
      const mesDadosLabel = `${MESES_PT[mesDados - 1]} ${anoDados}`;

      // Determine current quarter for OKR targets (baseado no mês dos dados)
      const quarter = `Q${Math.ceil(mesDados / 3)}` as "Q1" | "Q2" | "Q3" | "Q4";

      // Run all queries in parallel
      const [
        novosResult,
        aniversariantesResult,
        aniversarioEmpresaResult,
        actualsResult,
        rankingResult,
        closerPhotosResult,
        graficoResult,
      ] = await Promise.all([
        // 1. Novos colaboradores (admitidos no mês de dados)
        db.execute(sql`
          SELECT
            r.id, r.nome, r.cargo, r.squad, r.admissao::text,
            COALESCE(
              NULLIF(a_id.picture, ''),
              NULLIF(a_turbo.picture, ''),
              NULLIF(a_pessoal.picture, '')
            ) as foto_url
          FROM "Inhire".rh_pessoal r
          LEFT JOIN cortex_core.auth_users a_id ON r.user_id IS NOT NULL AND r.user_id = a_id.id
          LEFT JOIN cortex_core.auth_users a_turbo ON r.email_turbo IS NOT NULL AND LOWER(TRIM(r.email_turbo)) = LOWER(TRIM(a_turbo.email))
          LEFT JOIN cortex_core.auth_users a_pessoal ON r.email_pessoal IS NOT NULL AND LOWER(TRIM(r.email_pessoal)) = LOWER(TRIM(a_pessoal.email))
          WHERE EXTRACT(MONTH FROM r.admissao) = ${mesDados}
            AND EXTRACT(YEAR FROM r.admissao) = ${anoDados}
            AND r.status = 'Ativo'
          ORDER BY r.admissao
        `),

        // 2. Aniversariantes do mês de dados (birthdays)
        db.execute(sql`
          SELECT
            r.id, r.nome, r.cargo, r.squad,
            r.aniversario::text,
            EXTRACT(DAY FROM r.aniversario)::int as dia,
            COALESCE(
              NULLIF(a_id.picture, ''),
              NULLIF(a_turbo.picture, ''),
              NULLIF(a_pessoal.picture, '')
            ) as foto_url
          FROM "Inhire".rh_pessoal r
          LEFT JOIN cortex_core.auth_users a_id ON r.user_id IS NOT NULL AND r.user_id = a_id.id
          LEFT JOIN cortex_core.auth_users a_turbo ON r.email_turbo IS NOT NULL AND LOWER(TRIM(r.email_turbo)) = LOWER(TRIM(a_turbo.email))
          LEFT JOIN cortex_core.auth_users a_pessoal ON r.email_pessoal IS NOT NULL AND LOWER(TRIM(r.email_pessoal)) = LOWER(TRIM(a_pessoal.email))
          WHERE EXTRACT(MONTH FROM r.aniversario) = ${mesDados}
            AND r.status = 'Ativo'
          ORDER BY EXTRACT(DAY FROM r.aniversario)
        `),

        // 3. Aniversários de empresa no mês de dados (work anniversaries)
        db.execute(sql`
          SELECT
            r.id, r.nome, r.cargo, r.squad, r.admissao::text,
            (${anoDados} - EXTRACT(YEAR FROM r.admissao))::int as anos_de_empresa,
            COALESCE(
              NULLIF(a_id.picture, ''),
              NULLIF(a_turbo.picture, ''),
              NULLIF(a_pessoal.picture, '')
            ) as foto_url
          FROM "Inhire".rh_pessoal r
          LEFT JOIN cortex_core.auth_users a_id ON r.user_id IS NOT NULL AND r.user_id = a_id.id
          LEFT JOIN cortex_core.auth_users a_turbo ON r.email_turbo IS NOT NULL AND LOWER(TRIM(r.email_turbo)) = LOWER(TRIM(a_turbo.email))
          LEFT JOIN cortex_core.auth_users a_pessoal ON r.email_pessoal IS NOT NULL AND LOWER(TRIM(r.email_pessoal)) = LOWER(TRIM(a_pessoal.email))
          WHERE EXTRACT(MONTH FROM r.admissao) = ${mesDados}
            AND r.status = 'Ativo'
            AND r.admissao IS NOT NULL
            AND EXTRACT(YEAR FROM r.admissao) < ${anoDados}
          ORDER BY EXTRACT(DAY FROM r.admissao)
        `),

        // 4. OKR actuals for the data month
        db.execute(sql`
          SELECT metric_key, actual_value::numeric
          FROM cortex_core.metric_actuals_monthly
          WHERE year = ${anoDados} AND month = ${mesDados}
            AND dimension_key IS NULL
        `),

        // 5. Ranking closers (deals won in the data month)
        db.execute(sql`
          SELECT
            c.nome as name,
            COALESCE(SUM(d.valor_recorrente), 0)::numeric as mrr_obtido,
            COALESCE(SUM(d.valor_pontual), 0)::numeric as pontual_obtido,
            COALESCE(SUM(d.valor_recorrente), 0)::numeric + COALESCE(SUM(d.valor_pontual), 0)::numeric as total_obtido,
            COUNT(*)::int as negocios_ganhos
          FROM "Bitrix".crm_deal d
          JOIN "Bitrix".crm_closers c ON CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = c.id
          WHERE d.stage_name = 'Negócio Ganho'
            AND d.data_fechamento >= ${`${anoDados}-${String(mesDados).padStart(2, '0')}-01`}
            AND d.data_fechamento < ${`${ano}-${String(mes).padStart(2, '0')}-01`}
          GROUP BY c.nome
          ORDER BY mrr_obtido DESC
        `),

        // 6. Closer photos
        db.execute(sql`
          SELECT c.nome as name, a.picture
          FROM "Bitrix".crm_closers c
          LEFT JOIN cortex_core.auth_users a ON LOWER(TRIM(c.email)) = LOWER(TRIM(a.email))
          WHERE c.email IS NOT NULL AND a.picture IS NOT NULL
        `),

        // 7. Contracts data for the data month only
        db.execute(sql`
          SELECT
            COUNT(CASE WHEN COALESCE(d.valor_recorrente, 0) > 0 THEN 1 END)::int as contratos_recorrente,
            COUNT(CASE WHEN COALESCE(d.valor_pontual, 0) > 0 THEN 1 END)::int as contratos_pontual,
            COALESCE(SUM(d.valor_recorrente), 0)::numeric as receita_recorrente,
            COALESCE(SUM(d.valor_pontual), 0)::numeric as receita_pontual
          FROM "Bitrix".crm_deal d
          WHERE d.stage_name = 'Negócio Ganho'
            AND d.data_fechamento >= ${`${anoDados}-${String(mesDados).padStart(2, '0')}-01`}
            AND d.data_fechamento < ${`${ano}-${String(mes).padStart(2, '0')}-01`}
        `),
      ]);

      // Build closer photo map
      const photoMap: Record<string, string> = {};
      (closerPhotosResult.rows as any[]).forEach((row: any) => {
        if (row.picture && row.name) photoMap[row.name] = row.picture;
      });

      // Build actuals map
      const actualsMap: Record<string, number> = {};
      (actualsResult.rows as any[]).forEach((row: any) => {
        actualsMap[row.metric_key] = parseFloat(row.actual_value) || 0;
      });

      // Build OKR objectives with KRs (O1 and O2)
      const okrObjectives = objectives
        .filter(o => o.id === "O1" || o.id === "O2")
        .map(obj => {
          const objKrs = krs
            .filter(kr => kr.objectiveId === obj.id)
            .map(kr => {
              const targetQ = kr.targets[quarter] || 0;
              const actual = actualsMap[kr.metricKey] ?? null;
              let achievement = 0;
              if (actual !== null && targetQ > 0) {
                achievement = kr.direction === "lte"
                  ? Math.max(0, Math.min(100, ((targetQ - actual) / targetQ) * 100 + 100))
                  : Math.min(100, (actual / targetQ) * 100);
              }
              return {
                id: kr.id,
                title: kr.title,
                unit: kr.unit,
                direction: kr.direction,
                targetQ,
                actual,
                achievement: Math.round(achievement),
              };
            });
          return {
            id: obj.id,
            title: obj.title,
            subtitle: obj.subtitle,
            krs: objKrs,
          };
        });

      // Build ranking with photos
      const rankingClosers = (rankingResult.rows as any[]).map((row: any) => ({
        name: row.name,
        fotoUrl: photoMap[row.name] || null,
        mrrObtido: parseFloat(row.mrr_obtido) || 0,
        pontualObtido: parseFloat(row.pontual_obtido) || 0,
        totalObtido: parseFloat(row.total_obtido) || 0,
        negociosGanhos: parseInt(row.negocios_ganhos) || 0,
      }));

      // Top pontual (sorted by pontual)
      const topPontual = [...rankingClosers].sort((a, b) => b.pontualObtido - a.pontualObtido)[0] || null;

      // Build contracts data (single month)
      const contratosRow = (graficoResult.rows as any[])[0] || {};
      const totalRecorrente = parseFloat(contratosRow.receita_recorrente) || 0;
      const totalPontual = parseFloat(contratosRow.receita_pontual) || 0;
      const totalContratosRec = parseInt(contratosRow.contratos_recorrente) || 0;
      const totalContratosPont = parseInt(contratosRow.contratos_pontual) || 0;
      const numContratos = totalContratosRec + totalContratosPont;

      res.json({
        mesReferencia: mesParam,
        mesLabel,
        mesDadosLabel,
        novosColaboradores: novosResult.rows,
        aniversariantes: aniversariantesResult.rows,
        aniversariosEmpresa: aniversarioEmpresaResult.rows,
        okrObjectives,
        rankingClosers,
        topPontual,
        contratosMes: {
          numContratos,
          contratosRecorrente: totalContratosRec,
          contratosPontual: totalContratosPont,
          receitaRecorrente: totalRecorrente,
          receitaPontual: totalPontual,
          tmRecorrente: totalContratosRec > 0 ? totalRecorrente / totalContratosRec : 0,
          tmPontual: totalContratosPont > 0 ? totalPontual / totalContratosPont : 0,
        },
      });

    } catch (error: any) {
      console.error("[reports/mensal] Error:", error?.message || error);
      res.status(500).json({ error: "Erro ao gerar dados do reporte mensal", details: error?.message });
    }
  });
}

import type { Express } from "express";
import { sql } from "drizzle-orm";
import { objectives, krs } from "../okr2026/okrRegistry";

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

// Vendas de expansão (upsell/cross-sell) por mês e squad — slide "Detalhes por Squad".
// `vendas` é o valor total vendido no mês (card "Total de Vendas"); `abatimento` é a
// parcela descontada do churn s/ abonados para formar o NRR: contratos parcelados em
// 5x abatem 1/5 do valor no mês, vendas à vista abatem o valor integral.
// Chaves de squad normalizadas (sem emoji, sem "(OFF)", minúsculas — ver normalizeSquadName).
const VENDAS_EXPANSAO_POR_MES: Record<string, Record<string, { vendas: number; abatimento: number }>> = {
  "2026-05": {
    selva: { vendas: 9000, abatimento: 9000 / 5 },
    squadra: { vendas: 8000, abatimento: 8000 / 5 },
    pulse: { vendas: 4497, abatimento: 4497 },
  },
};

async function initCustomSlidesTable(db: any) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS cortex_core.relatorio_slides_custom (
      id SERIAL PRIMARY KEY,
      mes_ano VARCHAR(7) NOT NULL,
      posicao INTEGER NOT NULL DEFAULT 0,
      ordem INTEGER NOT NULL DEFAULT 0,
      titulo TEXT,
      subtitulo TEXT,
      image_url TEXT,
      criado_em TIMESTAMP DEFAULT NOW(),
      atualizado_em TIMESTAMP DEFAULT NOW()
    )
  `);
}

export function registerRelatorioMensalSlidesRoutes(app: Express, db: any) {

  // Initialize custom slides table
  initCustomSlidesTable(db).catch((err: any) =>
    console.error("[custom-slides] Failed to init table:", err?.message)
  );

  // --- Custom Slides CRUD ---

  app.get("/api/reports/mensal/custom-slides", async (req, res) => {
    try {
      const mes = req.query.mes as string;
      if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
        return res.status(400).json({ error: "Parâmetro 'mes' inválido. Use formato YYYY-MM." });
      }
      const result = await db.execute(sql`
        SELECT * FROM cortex_core.relatorio_slides_custom
        WHERE mes_ano = ${mes}
        ORDER BY posicao ASC, ordem ASC
      `);
      res.json(result.rows);
    } catch (error: any) {
      console.error("[custom-slides] GET error:", error?.message);
      res.status(500).json({ error: "Erro ao buscar custom slides" });
    }
  });

  app.post("/api/reports/mensal/custom-slides", async (req, res) => {
    try {
      const { mes_ano, posicao, titulo, subtitulo, image_url } = req.body;
      if (!mes_ano || !/^\d{4}-\d{2}$/.test(mes_ano)) {
        return res.status(400).json({ error: "Campo 'mes_ano' inválido." });
      }
      // Auto-increment ordem for same position
      const maxOrdem = await db.execute(sql`
        SELECT COALESCE(MAX(ordem), -1) + 1 as next_ordem
        FROM cortex_core.relatorio_slides_custom
        WHERE mes_ano = ${mes_ano} AND posicao = ${posicao ?? 0}
      `);
      const ordem = maxOrdem.rows[0]?.next_ordem ?? 0;
      const result = await db.execute(sql`
        INSERT INTO cortex_core.relatorio_slides_custom (mes_ano, posicao, ordem, titulo, subtitulo, image_url)
        VALUES (${mes_ano}, ${posicao ?? 0}, ${ordem}, ${titulo ?? null}, ${subtitulo ?? null}, ${image_url ?? null})
        RETURNING *
      `);
      res.json(result.rows[0]);
    } catch (error: any) {
      console.error("[custom-slides] POST error:", error?.message);
      res.status(500).json({ error: "Erro ao criar custom slide" });
    }
  });

  app.delete("/api/reports/mensal/custom-slides/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
      await db.execute(sql`
        DELETE FROM cortex_core.relatorio_slides_custom WHERE id = ${id}
      `);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[custom-slides] DELETE error:", error?.message);
      res.status(500).json({ error: "Erro ao deletar custom slide" });
    }
  });

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

      // Mês selecionado = mês dos dados (sem offset).
      const mesDados = mes;
      const anoDados = ano;
      const mesDadosLabel = `${MESES_PT[mesDados - 1]} ${anoDados}`;

      // Determine current quarter for OKR targets (baseado no mês dos dados)
      const quarter = `Q${Math.ceil(mesDados / 3)}` as "Q1" | "Q2" | "Q3" | "Q4";
      const quarterStartMonth = Math.floor((mesDados - 1) / 3) * 3 + 1; // 1 for Q1, 4 for Q2, etc.

      // dataEnd = primeiro dia do mês seguinte ao mês dos dados (limite superior exclusivo)
      const nextMesDados = mesDados === 12 ? 1 : mesDados + 1;
      const nextAnoDados = mesDados === 12 ? anoDados + 1 : anoDados;

      const dataStart = `${anoDados}-${String(mesDados).padStart(2, '0')}-01`;
      const dataEnd = `${nextAnoDados}-${String(nextMesDados).padStart(2, '0')}-01`;
      const ytdStart = `${anoDados}-01-01`;

      // Run all queries in parallel
      const [
        novosResult,
        aniversariantesResult,
        aniversarioEmpresaResult,
        actualsResult,
        rankingResult,
        closerPhotosResult,
        rankingSdrResult,
        sdrPhotosResult,
        sdrReunioesResult,
        graficoResult,
        quarterSalesResult,
        turboMrrResult,
        turboClientesResult,
        turboChurnResult,
        turboCxcsResult,
        crosssellPorCloserResult,
        turboFaturamentoResult,
        turboRetencoesResult,
        indicacoesResult,
        pipelineBreakdownResult,
        receitaChurnResult,
        rankingSquadsResult,
        churnSquadsResult,
        pontualEntregueSquadResult,
        mrrAnteriorSquadsResult,
        mrrAnteriorTotalResult,
        techKpisEntreguesResult,
        techKpisAdicionadosResult,
        techEntregasPorTipoResult,
        techEmAbertoResult,
        techPipelineResult,
        okrFaturamentoResult,
        okrChurnResult,
        okrTechResult,
        okrInadResult,
        okrHeadcountResult,
        okrPrazoResult,
        vendasSeriesResult,
        pontualCommerceQtrResult,
        pontualEmAbertoResult,
        pontualAquisicaoResult,
        pontualEntregasSquadResult,
        pontualEntregasProdutoMesResult,
        pontualTempoMedioResult,
        faturamentoYtdResult,
        dfcRecebimentoYtdResult,
        topMrrResult,
        topMrrPontualResult,
        topEntregasResult,
      ] = await Promise.all([
        // 1. Novos colaboradores (admitidos no mês de dados)
        db.execute(sql`
          SELECT
            r.id, r.nome, r.cargo, r.squad, r.admissao::text,
            COALESCE(
              NULLIF(a_id.picture, ''),
              NULLIF(a_turbo.picture, ''),
              NULLIF(a_pessoal.picture, '')
            ) as "fotoUrl"
          FROM "Inhire".rh_pessoal r
          LEFT JOIN cortex_core.auth_users a_id ON r.user_id IS NOT NULL AND r.user_id = a_id.id
          LEFT JOIN cortex_core.auth_users a_turbo ON r.email_turbo IS NOT NULL AND LOWER(TRIM(r.email_turbo)) = LOWER(TRIM(a_turbo.email))
          LEFT JOIN cortex_core.auth_users a_pessoal ON r.email_pessoal IS NOT NULL AND LOWER(TRIM(r.email_pessoal)) = LOWER(TRIM(a_pessoal.email))
          WHERE EXTRACT(MONTH FROM r.admissao) = ${mesDados}
            AND EXTRACT(YEAR FROM r.admissao) = ${anoDados}
            AND r.status = 'Ativo'
          ORDER BY r.admissao
        `),

        // 2. Aniversariantes do mês ATUAL (birthdays do mês do reporte)
        db.execute(sql`
          SELECT
            r.id, r.nome, r.cargo, r.squad,
            r.aniversario::text,
            EXTRACT(DAY FROM r.aniversario)::int as dia,
            COALESCE(
              NULLIF(a_id.picture, ''),
              NULLIF(a_turbo.picture, ''),
              NULLIF(a_pessoal.picture, '')
            ) as "fotoUrl"
          FROM "Inhire".rh_pessoal r
          LEFT JOIN cortex_core.auth_users a_id ON r.user_id IS NOT NULL AND r.user_id = a_id.id
          LEFT JOIN cortex_core.auth_users a_turbo ON r.email_turbo IS NOT NULL AND LOWER(TRIM(r.email_turbo)) = LOWER(TRIM(a_turbo.email))
          LEFT JOIN cortex_core.auth_users a_pessoal ON r.email_pessoal IS NOT NULL AND LOWER(TRIM(r.email_pessoal)) = LOWER(TRIM(a_pessoal.email))
          WHERE EXTRACT(MONTH FROM r.aniversario) = ${nextMesDados}
            AND r.status = 'Ativo'
          ORDER BY EXTRACT(DAY FROM r.aniversario)
        `),

        // 3. Aniversários de empresa no mês VIGENTE (work anniversaries — alinhado com query #2 aniversariantes)
        db.execute(sql`
          SELECT
            r.id, r.nome, r.cargo, r.squad, r.admissao::text,
            (${nextAnoDados} - EXTRACT(YEAR FROM r.admissao))::int as "anosDeEmpresa",
            COALESCE(
              NULLIF(a_id.picture, ''),
              NULLIF(a_turbo.picture, ''),
              NULLIF(a_pessoal.picture, '')
            ) as "fotoUrl"
          FROM "Inhire".rh_pessoal r
          LEFT JOIN cortex_core.auth_users a_id ON r.user_id IS NOT NULL AND r.user_id = a_id.id
          LEFT JOIN cortex_core.auth_users a_turbo ON r.email_turbo IS NOT NULL AND LOWER(TRIM(r.email_turbo)) = LOWER(TRIM(a_turbo.email))
          LEFT JOIN cortex_core.auth_users a_pessoal ON r.email_pessoal IS NOT NULL AND LOWER(TRIM(r.email_pessoal)) = LOWER(TRIM(a_pessoal.email))
          WHERE EXTRACT(MONTH FROM r.admissao) = ${nextMesDados}
            AND r.status = 'Ativo'
            AND r.admissao IS NOT NULL
            AND EXTRACT(YEAR FROM r.admissao) < ${nextAnoDados}
          ORDER BY EXTRACT(DAY FROM r.admissao)
        `),

        // 4. OKR actuals for the full quarter (up to data month)
        db.execute(sql`
          SELECT metric_key, month, actual_value::numeric
          FROM cortex_core.metric_actuals_monthly
          WHERE year = ${anoDados}
            AND month >= ${quarterStartMonth}
            AND month <= ${mesDados}
            AND dimension_key IS NULL
          ORDER BY month
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
            AND d.data_fechamento < ${dataEnd}
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

        // 6b. Ranking SDRs (deals won in the data month, grouped by SDR)
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
            AND d.data_fechamento >= ${`${anoDados}-${String(mesDados).padStart(2, '0')}-01`}
            AND d.data_fechamento < ${dataEnd}
          GROUP BY u.nome
          ORDER BY mrr_gerado DESC
        `),

        // 6c. SDR photos
        db.execute(sql`
          SELECT u.nome as name, a.picture
          FROM "Bitrix".crm_users u
          LEFT JOIN cortex_core.auth_users a ON LOWER(TRIM(u.email)) = LOWER(TRIM(a.email))
          WHERE u.email IS NOT NULL AND a.picture IS NOT NULL
        `),

        // 6d. SDR reuniões (meetings held in the data month, grouped by SDR)
        db.execute(sql`
          SELECT
            u.nome as name,
            COUNT(*)::int as reunioes
          FROM "Bitrix".crm_deal d
          JOIN "Bitrix".crm_users u ON CASE WHEN d.sdr ~ '^[0-9]+$' THEN d.sdr::integer ELSE NULL END = u.id
          WHERE d.data_reuniao_realizada IS NOT NULL
            AND d.data_reuniao_realizada >= ${`${anoDados}-${String(mesDados).padStart(2, '0')}-01`}
            AND d.data_reuniao_realizada < ${dataEnd}
          GROUP BY u.nome
          ORDER BY reunioes DESC
          LIMIT 1
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
            AND d.data_fechamento < ${dataEnd}
        `),

        // 8. Quarter sales from crm_deal (for computing OKR actuals vendas_mrr/pontual)
        db.execute(sql`
          SELECT
            COALESCE(SUM(d.valor_recorrente), 0)::numeric as vendas_mrr,
            COALESCE(SUM(d.valor_pontual), 0)::numeric as vendas_pontual
          FROM "Bitrix".crm_deal d
          WHERE d.stage_name = 'Negócio Ganho'
            AND d.data_fechamento >= ${`${anoDados}-${String(quarterStartMonth).padStart(2, '0')}-01`}
            AND d.data_fechamento < ${dataEnd}
        `),

        // 9. MRR ativo + Ticket Médio ao final do mês de dados (snapshot do dia 1 do mês seguinte)
        db.execute(sql`
          WITH ultimo_snapshot AS (
            SELECT COALESCE(
              (SELECT data_snapshot FROM "Clickup".cup_data_hist WHERE data_snapshot = ${dataEnd}::date LIMIT 1),
              (SELECT MAX(data_snapshot) FROM "Clickup".cup_data_hist WHERE TO_CHAR(data_snapshot, 'YYYY-MM') = ${`${anoDados}-${String(mesDados).padStart(2, '0')}`})
            ) as snap
          )
          SELECT
            COALESCE(SUM(CASE WHEN h.valorr::numeric > 0 THEN h.valorr::numeric END), 0) as mrr_ativo,
            COALESCE(AVG(CASE WHEN h.valorr::numeric > 0 THEN h.valorr::numeric END), 0) as ticket_medio_contrato,
            COUNT(*)::int as contratos_ativos,
            COUNT(DISTINCT h.id_task)::int as clientes_ativos
          FROM "Clickup".cup_data_hist h
          JOIN ultimo_snapshot us ON h.data_snapshot = us.snap
          WHERE h.status IN ('ativo', 'onboarding', 'triagem')
            AND h.valorr IS NOT NULL
        `),

        // 10. Clientes totais + Contratos totais ao final do mês de dados
        db.execute(sql`
          WITH ultimo_snapshot AS (
            SELECT COALESCE(
              (SELECT data_snapshot FROM "Clickup".cup_data_hist WHERE data_snapshot = ${dataEnd}::date LIMIT 1),
              (SELECT MAX(data_snapshot) FROM "Clickup".cup_data_hist WHERE TO_CHAR(data_snapshot, 'YYYY-MM') = ${`${anoDados}-${String(mesDados).padStart(2, '0')}`})
            ) as snap
          )
          SELECT
            COUNT(DISTINCT h.id_task)::int as clientes_totais,
            COUNT(*)::int as contratos_totais
          FROM "Clickup".cup_data_hist h
          JOIN ultimo_snapshot us ON h.data_snapshot = us.snap
        `),

        // 11. Churn (cup_churn curada) e Pausados (cup_contratos) no mês de dados
        db.execute(sql`
          WITH churn_data AS (
            SELECT
              COALESCE(SUM(valor_r), 0)::numeric as churn_mrr,
              COUNT(*)::int as churn_count
            FROM cortex_core.vw_cup_churn_ajustado
            WHERE data_solicitacao_encerramento IS NOT NULL
              AND data_solicitacao_encerramento >= ${dataStart}
              AND data_solicitacao_encerramento < ${dataEnd}
              AND COALESCE(abonar_churn, '') != 'Sim'
              AND COALESCE(motivo_cancelamento, '') NOT IN ('Inadimplente 1º Mês', 'Não começou', 'Erro na Venda')
          ),
          pausados_data AS (
            SELECT
              COALESCE(SUM(COALESCE(valorr::numeric, 0)), 0) as pausados_mrr,
              COUNT(*)::int as pausados_count
            FROM "Clickup".cup_contratos
            WHERE LOWER(status) = 'pausado'
              AND data_pausa >= ${dataStart}
              AND data_pausa < ${dataEnd}
          )
          SELECT c.churn_mrr, c.churn_count, p.pausados_mrr, p.pausados_count
          FROM churn_data c, pausados_data p
        `),

        // 12. Cross-sell (deals with source PARTNER in data month)
        db.execute(sql`
          SELECT
            COALESCE(SUM(d.valor_recorrente), 0)::numeric as crosssell_mrr,
            COALESCE(SUM(d.valor_pontual), 0)::numeric as crosssell_pontual,
            COUNT(*)::int as solicitacoes
          FROM "Bitrix".crm_deal d
          WHERE d.stage_name = 'Negócio Ganho'
            AND d.source = 'PARTNER'
            AND d.data_fechamento >= ${dataStart}
            AND d.data_fechamento < ${dataEnd}
        `),

        // 12b. Cross-sell por closer (source PARTNER, mês de dados)
        db.execute(sql`
          SELECT
            COALESCE(c.nome, 'Sem Responsável') as nome,
            COALESCE(SUM(d.valor_recorrente), 0)::numeric as mrr,
            COALESCE(SUM(d.valor_pontual), 0)::numeric as pontual,
            COUNT(*)::int as contratos
          FROM "Bitrix".crm_deal d
          LEFT JOIN "Bitrix".crm_closers c
            ON CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = c.id
          WHERE d.stage_name = 'Negócio Ganho'
            AND d.source = 'PARTNER'
            AND d.data_fechamento >= ${dataStart}
            AND d.data_fechamento < ${dataEnd}
          GROUP BY COALESCE(c.nome, 'Sem Responsável')
          ORDER BY (COALESCE(SUM(d.valor_recorrente), 0) + COALESCE(SUM(d.valor_pontual), 0)) DESC
        `),

        // 13. Faturamento pontual do mês (cup_contratos — data_entrega no mês)
        db.execute(sql`
          SELECT
            COALESCE(SUM(valorp::numeric), 0) as faturamento_pontual
          FROM "Clickup".cup_contratos
          WHERE data_entrega >= ${dataStart}
            AND data_entrega < ${dataEnd}
            AND valorp IS NOT NULL
            AND valorp::numeric > 0
        `),

        // 13b. Retenções CXCS (solicitações + retidos no mês de dados)
        db.execute(sql`
          SELECT
            COUNT(*)::int as solicitacoes_count,
            COALESCE(SUM(valor_r), 0)::numeric as solicitacoes_valor,
            COUNT(CASE WHEN reteve = 'Sim' THEN 1 END)::int as retencoes_count,
            COALESCE(SUM(CASE WHEN reteve = 'Sim' THEN valor_r ELSE 0 END), 0)::numeric as retencoes_valor
          FROM cortex_core.vw_cup_churn_ajustado
          WHERE data_solicitacao_encerramento IS NOT NULL
            AND data_solicitacao_encerramento >= ${dataStart}
            AND data_solicitacao_encerramento < ${dataEnd}
            AND COALESCE(motivo_cancelamento, '') NOT IN ('Inadimplente 1º Mês', 'Não começou', 'Erro na Venda')
        `),

        // 13c. Indicações (source = RECOMMENDATION no mês de dados)
        db.execute(sql`
          SELECT
            COUNT(*)::int as indicacoes_recebidas,
            COUNT(CASE WHEN stage_name = 'Negócio Ganho' THEN 1 END)::int as contratos_fechados,
            COALESCE(SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN valor_recorrente::numeric ELSE 0 END), 0) as valor_recorrente,
            COALESCE(SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN valor_pontual::numeric ELSE 0 END), 0) as valor_pontual
          FROM "Bitrix".crm_deal
          WHERE source = 'RECOMMENDATION'
            AND data_fechamento >= ${dataStart}
            AND data_fechamento < ${dataEnd}
        `),

        // 13d. Pipeline breakdown (Inbound/Outbound/Geral)
        db.execute(sql`
          SELECT
            COALESCE(d.category_name, 'Outros') as pipeline,
            COUNT(*)::int as contratos,
            COALESCE(SUM(d.valor_recorrente), 0)::numeric as receita_recorrente,
            COALESCE(SUM(d.valor_pontual), 0)::numeric as receita_pontual
          FROM "Bitrix".crm_deal d
          WHERE d.stage_name = 'Negócio Ganho'
            AND d.data_fechamento >= ${`${anoDados}-${String(mesDados).padStart(2, '0')}-01`}
            AND d.data_fechamento < ${dataEnd}
          GROUP BY d.category_name
          ORDER BY receita_recorrente DESC
        `),

        // 14. Série mensal Receita x Churn (últimos 12 meses até mesDados, cross-year)
        // Para cada mês, pega snapshot do dia 1 do mês seguinte (estado final do mês)
        // Fallback: MAX(data_snapshot) dentro do mês se dia 1 não existir
        db.execute(sql`
          WITH date_range AS (
            SELECT
              (${dataStart}::date - INTERVAL '11 months')::date as range_start,
              ${dataEnd}::date as range_end
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
            SELECT
              TO_CHAR(data_solicitacao_encerramento, 'YYYY-MM') as month,
              COALESCE(SUM(valor_r), 0) as churn_brl
            FROM cortex_core.vw_cup_churn_ajustado, date_range dr
            WHERE data_solicitacao_encerramento IS NOT NULL
              AND data_solicitacao_encerramento >= dr.range_start
              AND data_solicitacao_encerramento < dr.range_end
              AND COALESCE(abonar_churn, '') != 'Sim'
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
            COALESCE(p.pontual, 0) as pontual,
            COALESCE(c.churn_brl, 0) as churn_brl
          FROM mrr_mensal m
          LEFT JOIN churn_mensal c ON m.month = c.month
          LEFT JOIN pontual_mensal p ON m.month = p.month
          ORDER BY m.month
        `),

        // 15. Ranking Squads por MRR + Pontual (snapshot do dia 1 do mês seguinte)
        db.execute(sql`
          WITH ultimo_snapshot AS (
            SELECT COALESCE(
              (SELECT data_snapshot FROM "Clickup".cup_data_hist WHERE data_snapshot = ${dataEnd}::date LIMIT 1),
              (SELECT MAX(data_snapshot) FROM "Clickup".cup_data_hist WHERE TO_CHAR(data_snapshot, 'YYYY-MM') = ${`${anoDados}-${String(mesDados).padStart(2, '0')}`})
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

        // 16. Churn por squad no mês de dados (usa cup_churn - tabela curada)
        // Total = todos os churns; "sem abonados" desconta apenas pela coluna abonar_churn.
        // clientes: lista p/ tooltip (nome do cliente via cup_clientes; só contratos com valor_r > 0)
        db.execute(sql`
          SELECT
            v.squad,
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
            AND v.data_solicitacao_encerramento >= ${dataStart}
            AND v.data_solicitacao_encerramento < ${dataEnd}
            AND v.squad IS NOT NULL
            AND TRIM(v.squad) != ''
          GROUP BY v.squad
        `),

        // 16b. Pontual entregue no mês por squad (cup_contratos com data_entrega no mês)
        db.execute(sql`
          SELECT
            squad,
            COALESCE(SUM(valorp::numeric), 0)::numeric as pontual
          FROM "Clickup".cup_contratos
          WHERE LOWER(TRIM(status)) = 'entregue'
            AND data_entrega >= ${dataStart}::date
            AND data_entrega < ${dataEnd}::date
            AND COALESCE(valorp, 0) > 0
            AND squad IS NOT NULL
            AND TRIM(squad) != ''
          GROUP BY squad
        `),

        // 17. MRR do mês anterior por squad (snapshot do dia 1 do mês de dados = final do mês anterior)
        db.execute(sql`
          WITH ultimo_snapshot_ant AS (
            SELECT COALESCE(
              (SELECT data_snapshot FROM "Clickup".cup_data_hist WHERE data_snapshot = ${dataStart}::date LIMIT 1),
              (SELECT MAX(data_snapshot) FROM "Clickup".cup_data_hist WHERE TO_CHAR(data_snapshot, 'YYYY-MM') = ${
                mesDados === 1
                  ? `${anoDados - 1}-12`
                  : `${anoDados}-${String(mesDados - 1).padStart(2, '0')}`
              })
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

        // 17b. MRR total do mês anterior (para meta de churn = 8% do MRR ativo)
        db.execute(sql`
          WITH ultimo_snapshot_ant AS (
            SELECT COALESCE(
              (SELECT data_snapshot FROM "Clickup".cup_data_hist WHERE data_snapshot = ${dataStart}::date LIMIT 1),
              (SELECT MAX(data_snapshot) FROM "Clickup".cup_data_hist WHERE TO_CHAR(data_snapshot, 'YYYY-MM') = ${
                mesDados === 1
                  ? `${anoDados - 1}-12`
                  : `${anoDados}-${String(mesDados - 1).padStart(2, '0')}`
              })
            ) as snap
          )
          SELECT
            COALESCE(SUM(CASE WHEN h.valorr::numeric > 0 THEN h.valorr::numeric END), 0) as mrr_total
          FROM "Clickup".cup_data_hist h
          JOIN ultimo_snapshot_ant us ON h.data_snapshot = us.snap
          WHERE h.status IN ('ativo', 'onboarding', 'triagem')
            AND h.valorr IS NOT NULL
        `),

        // 18. Tech KPIs - Entregues no mês de dados (ambas tabelas)
        // Usa COALESCE(data_entregue, lancamento) para priorizar data real de entrega
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
          WHERE TO_CHAR(COALESCE(data_entregue, lancamento), 'YYYY-MM') = ${`${anoDados}-${String(mesDados).padStart(2, '0')}`}
        `),

        // 18b. Tech KPIs - Adicionados no mês de dados (ambas tabelas)
        db.execute(sql`
          SELECT
            COUNT(*)::int as adicionados,
            COALESCE(SUM(valor_p), 0)::numeric as valor_adicionados
          FROM (
            SELECT valor_p, data_criada FROM "Clickup".cup_projetos_tech
            UNION ALL
            SELECT valor_p, data_criada FROM "Clickup".cup_projetos_tech_fechados
          ) combined
          WHERE TO_CHAR(data_criada, 'YYYY-MM') = ${`${anoDados}-${String(mesDados).padStart(2, '0')}`}
        `),

        // 19. Projetos por tipo/mês - últimos 12 meses (ambas tabelas)
        // Usa COALESCE(data_entregue, lancamento) para priorizar data real de entrega
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
            AND COALESCE(data_entregue, lancamento) >= (${dataEnd}::date - INTERVAL '12 months')
            AND COALESCE(data_entregue, lancamento) < ${dataEnd}::date
          GROUP BY TO_CHAR(COALESCE(data_entregue, lancamento), 'YYYY-MM'), TRIM(tipo)
          ORDER BY month, tipo
        `),

        // 20. Projetos em aberto por tipo (pie chart)
        db.execute(sql`
          SELECT
            COALESCE(TRIM(tipo), 'Outros') as tipo,
            COUNT(*)::int as quantidade,
            COALESCE(SUM(valor_p), 0)::numeric as valor
          FROM "Clickup".cup_projetos_tech
          GROUP BY TRIM(tipo)
          ORDER BY valor DESC
        `),

        // 20b. Pipeline Tech - projetos em aberto por status
        db.execute(sql`
          SELECT
            COALESCE(TRIM(status_projeto), 'Sem Status') as status,
            COUNT(*)::int as quantidade
          FROM "Clickup".cup_projetos_tech
          GROUP BY TRIM(status_projeto)
          ORDER BY quantidade DESC
        `),

        // 21. OKR: faturamento_legado (caz_parcelas por mês no quarter)
        db.execute(sql`
          SELECT
            EXTRACT(MONTH FROM data_vencimento)::int as month,
            COALESCE(SUM(valor_bruto::numeric), 0) as valor
          FROM "Conta Azul".caz_parcelas
          WHERE tipo_evento = 'RECEITA'
            AND EXTRACT(YEAR FROM data_vencimento) = ${anoDados}
            AND EXTRACT(MONTH FROM data_vencimento) >= ${quarterStartMonth}
            AND EXTRACT(MONTH FROM data_vencimento) <= ${mesDados}
          GROUP BY EXTRACT(MONTH FROM data_vencimento)
        `),

        // 22. OKR: churn_brl por mês no quarter (usa cup_churn curada)
        db.execute(sql`
          SELECT
            EXTRACT(MONTH FROM data_solicitacao_encerramento)::int as month,
            COALESCE(SUM(valor_r), 0)::numeric as valor
          FROM cortex_core.vw_cup_churn_ajustado
          WHERE data_solicitacao_encerramento IS NOT NULL
            AND EXTRACT(YEAR FROM data_solicitacao_encerramento) = ${anoDados}
            AND EXTRACT(MONTH FROM data_solicitacao_encerramento) >= ${quarterStartMonth}
            AND EXTRACT(MONTH FROM data_solicitacao_encerramento) <= ${mesDados}
            AND COALESCE(abonar_churn, '') != 'Sim'
            AND COALESCE(motivo_cancelamento, '') NOT IN ('Inadimplente 1º Mês', 'Não começou', 'Erro na Venda')
          GROUP BY EXTRACT(MONTH FROM data_solicitacao_encerramento)
        `),

        // 23. OKR: projetos_tech valor entregue por mês no quarter (ambas tabelas)
        db.execute(sql`
          SELECT
            EXTRACT(MONTH FROM lancamento)::int as month,
            COALESCE(SUM(valor_p), 0)::numeric as valor
          FROM (
            SELECT lancamento, valor_p FROM "Clickup".cup_projetos_tech_fechados
            UNION ALL
            SELECT lancamento, valor_p FROM "Clickup".cup_projetos_tech
          ) combined
          WHERE EXTRACT(YEAR FROM lancamento) = ${anoDados}
            AND EXTRACT(MONTH FROM lancamento) >= ${quarterStartMonth}
            AND EXTRACT(MONTH FROM lancamento) <= ${mesDados}
            AND lancamento IS NOT NULL
          GROUP BY EXTRACT(MONTH FROM lancamento)
        `),

        // 24. OKR: inadimplencia_brl (parcelas vencidas não pagas no quarter)
        // Usa dataEnd (1o dia do mês seguinte) como corte fixo para reprodutibilidade
        db.execute(sql`
          SELECT
            EXTRACT(MONTH FROM data_vencimento)::int as month,
            COALESCE(SUM(valor_bruto::numeric), 0) as valor
          FROM "Conta Azul".caz_parcelas
          WHERE tipo_evento = 'RECEITA'
            AND status != 'QUITADO'
            AND data_vencimento < ${dataEnd}::date
            AND EXTRACT(YEAR FROM data_vencimento) = ${anoDados}
            AND EXTRACT(MONTH FROM data_vencimento) >= ${quarterStartMonth}
            AND EXTRACT(MONTH FROM data_vencimento) <= ${mesDados}
          GROUP BY EXTRACT(MONTH FROM data_vencimento)
        `),

        // 25. OKR: headcount ativo (para faturamento_por_pessoa)
        db.execute(sql`
          SELECT COUNT(*)::int as total FROM "Inhire".rh_pessoal WHERE status = 'Ativo'
        `),

        // 26. OKR: entregas no prazo (% de projetos entregues antes do vencimento)
        db.execute(sql`
          SELECT
            COUNT(*)::int as total,
            COUNT(CASE WHEN lancamento <= data_vencimento THEN 1 END)::int as no_prazo
          FROM (
            SELECT lancamento, data_vencimento FROM "Clickup".cup_projetos_tech_fechados
            UNION ALL
            SELECT lancamento, data_vencimento FROM "Clickup".cup_projetos_tech
          ) combined
          WHERE lancamento IS NOT NULL AND data_vencimento IS NOT NULL
            AND EXTRACT(YEAR FROM lancamento) = ${anoDados}
            AND EXTRACT(MONTH FROM lancamento) >= ${quarterStartMonth}
            AND EXTRACT(MONTH FROM lancamento) <= ${mesDados}
        `),

        // 27. Vendas mensais (MRR + Pontual) por mês do ano de dados
        db.execute(sql`
          SELECT
            TO_CHAR(d.data_fechamento, 'YYYY-MM') as month,
            COALESCE(SUM(d.valor_recorrente), 0)::numeric as vendas_mrr,
            COALESCE(SUM(d.valor_pontual), 0)::numeric as vendas_pontual,
            COUNT(*)::int as num_contratos
          FROM "Bitrix".crm_deal d
          WHERE d.stage_name = 'Negócio Ganho'
            AND d.data_fechamento >= ${`${anoDados}-01-01`}
            AND d.data_fechamento < ${dataEnd}
          GROUP BY TO_CHAR(d.data_fechamento, 'YYYY-MM')
          ORDER BY month
        `),

        // 28. Pontual Commerce acumulado no trimestre (cup_contratos data_entrega)
        db.execute(sql`
          SELECT COALESCE(SUM(valorp::numeric), 0) as pontual_commerce_qtr
          FROM "Clickup".cup_contratos
          WHERE data_entrega >= ${`${anoDados}-${String(quarterStartMonth).padStart(2, '0')}-01`}
            AND data_entrega < ${dataEnd}
            AND valorp IS NOT NULL
            AND valorp::numeric > 0
        `),

        // 29. Pontual em aberto — por serviço (slide Pontual)
        // Serviços com "Creators" no nome são agrupados como "Creators"
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

        // 30. Aquisição pontual do mês (contratos criados com valorp > 0)
        db.execute(sql`
          SELECT
            COUNT(*)::int as contratos,
            COALESCE(SUM(valorp::numeric), 0) as valor
          FROM "Clickup".cup_contratos
          WHERE valorp IS NOT NULL AND valorp::numeric > 0
            AND data_criado >= ${dataStart}::date
            AND data_criado < ${dataEnd}::date
        `),

        // 31. Entregas do mês por squad
        db.execute(sql`
          SELECT
            COALESCE(NULLIF(TRIM(squad), ''), 'Sem Squad') as squad,
            COUNT(*)::int as contratos,
            COALESCE(SUM(valorp::numeric), 0) as valor
          FROM "Clickup".cup_contratos
          WHERE valorp IS NOT NULL AND valorp::numeric > 0
            AND LOWER(TRIM(status)) = 'entregue'
            AND data_entrega >= ${dataStart}::date
            AND data_entrega < ${dataEnd}::date
          GROUP BY COALESCE(NULLIF(TRIM(squad), ''), 'Sem Squad')
          ORDER BY valor DESC
        `),

        // 32. Entregas por produto × mês (ano do relatório)
        db.execute(sql`
          SELECT
            TO_CHAR(data_entrega, 'YYYY-MM') as month,
            COALESCE(NULLIF(TRIM(produto), ''), 'Sem produto') as produto,
            COALESCE(SUM(valorp::numeric), 0) as valor
          FROM "Clickup".cup_contratos
          WHERE valorp IS NOT NULL AND valorp::numeric > 0
            AND LOWER(TRIM(status)) = 'entregue'
            AND data_entrega IS NOT NULL
            AND EXTRACT(YEAR FROM data_entrega) = ${anoDados}
          GROUP BY TO_CHAR(data_entrega, 'YYYY-MM'), COALESCE(NULLIF(TRIM(produto), ''), 'Sem produto')
          ORDER BY month, valor DESC
        `),

        // 33. Tempo médio de entrega por produto (últimos 6 meses antes do mês do relatório)
        db.execute(sql`
          SELECT
            COALESCE(NULLIF(TRIM(produto), ''), 'Sem produto') as produto,
            COUNT(*)::int as contratos,
            AVG(data_entrega - data_criado)::int as dias_medio
          FROM "Clickup".cup_contratos
          WHERE LOWER(TRIM(status)) = 'entregue'
            AND data_entrega IS NOT NULL
            AND data_criado IS NOT NULL
            AND data_entrega >= (${dataStart}::date - INTERVAL '6 months')
            AND data_entrega < ${dataEnd}::date
          GROUP BY COALESCE(NULLIF(TRIM(produto), ''), 'Sem produto')
          HAVING COUNT(*) >= 2
          ORDER BY dias_medio ASC
        `),

        // Faturamento Bruto YTD + Inadimplência YTD
        db.execute(sql`
          SELECT
            COALESCE(SUM(valor_bruto::numeric), 0) AS faturamento_bruto_ytd,
            COALESCE(SUM(CASE WHEN nao_pago::numeric > 0 THEN nao_pago::numeric ELSE 0 END), 0) AS inadimplencia_ytd
          FROM "Conta Azul".caz_parcelas
          WHERE tipo_evento = 'RECEITA'
            AND data_vencimento >= ${ytdStart}::date
            AND data_vencimento < ${dataEnd}::date
        `),

        // Imposto sobre Receita YTD (05.05) + DFC Recebimento mensal agrupado por mês
        db.execute(sql`
          SELECT
            TO_CHAR(data_quitacao::date, 'YYYY-MM') AS month,
            COALESCE(SUM(CASE WHEN tipo_evento = 'DESPESA' AND categoria_nome LIKE '05.05%' THEN valor_pago::numeric ELSE 0 END), 0) AS imposto,
            COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' THEN valor_pago::numeric ELSE 0 END), 0) AS recebido
          FROM "Conta Azul".caz_parcelas
          WHERE status = 'QUITADO'
            AND data_quitacao::date >= ${ytdStart}::date
            AND data_quitacao::date < ${dataEnd}::date
          GROUP BY TO_CHAR(data_quitacao::date, 'YYYY-MM')
          ORDER BY month
        `),

        // 24a. Top 3 MRR Ativo por responsável no snapshot do final do mês de dados + foto via rh_pessoal -> auth_users
        db.execute(sql`
          WITH ultimo_snapshot AS (
            SELECT COALESCE(
              (SELECT data_snapshot FROM "Clickup".cup_data_hist WHERE data_snapshot = ${dataEnd}::date LIMIT 1),
              (SELECT MAX(data_snapshot) FROM "Clickup".cup_data_hist WHERE TO_CHAR(data_snapshot, 'YYYY-MM') = ${`${anoDados}-${String(mesDados).padStart(2, '0')}`})
            ) as snap
          ),
          ranking AS (
            SELECT
              h.responsavel as nome,
              COALESCE(SUM(CASE WHEN h.valorr::numeric > 0 THEN h.valorr::numeric END), 0) as valor
            FROM "Clickup".cup_data_hist h
            JOIN ultimo_snapshot us ON h.data_snapshot = us.snap
            WHERE h.status IN ('ativo', 'onboarding', 'triagem')
              AND h.valorr IS NOT NULL
              AND h.responsavel IS NOT NULL
              AND TRIM(h.responsavel) != ''
            GROUP BY h.responsavel
            ORDER BY valor DESC
            LIMIT 3
          )
          SELECT
            r.nome,
            r.valor,
            COALESCE(
              NULLIF(a_id.picture, ''),
              NULLIF(a_turbo.picture, ''),
              NULLIF(a_pessoal.picture, '')
            ) as "fotoUrl",
            p.cargo
          FROM ranking r
          LEFT JOIN "Inhire".rh_pessoal p ON LOWER(TRIM(p.nome)) = LOWER(TRIM(r.nome))
          LEFT JOIN cortex_core.auth_users a_id ON p.user_id IS NOT NULL AND p.user_id = a_id.id
          LEFT JOIN cortex_core.auth_users a_turbo ON p.email_turbo IS NOT NULL AND LOWER(TRIM(p.email_turbo)) = LOWER(TRIM(a_turbo.email))
          LEFT JOIN cortex_core.auth_users a_pessoal ON p.email_pessoal IS NOT NULL AND LOWER(TRIM(p.email_pessoal)) = LOWER(TRIM(a_pessoal.email))
          ORDER BY r.valor DESC
        `),

        // 24b. Top 3 (MRR Ativo + Pontual Entregue) por responsável + foto
        db.execute(sql`
          WITH ultimo_snapshot AS (
            SELECT COALESCE(
              (SELECT data_snapshot FROM "Clickup".cup_data_hist WHERE data_snapshot = ${dataEnd}::date LIMIT 1),
              (SELECT MAX(data_snapshot) FROM "Clickup".cup_data_hist WHERE TO_CHAR(data_snapshot, 'YYYY-MM') = ${`${anoDados}-${String(mesDados).padStart(2, '0')}`})
            ) as snap
          ),
          mrr_por_resp AS (
            SELECT h.responsavel as nome,
                   COALESCE(SUM(CASE WHEN h.valorr::numeric > 0 THEN h.valorr::numeric END), 0) as mrr
            FROM "Clickup".cup_data_hist h
            JOIN ultimo_snapshot us ON h.data_snapshot = us.snap
            WHERE h.status IN ('ativo','onboarding','triagem')
              AND h.responsavel IS NOT NULL AND TRIM(h.responsavel) != ''
            GROUP BY h.responsavel
          ),
          pontual_por_resp AS (
            SELECT responsavel as nome,
                   COALESCE(SUM(valorp::numeric), 0) as pontual
            FROM "Clickup".cup_contratos
            WHERE LOWER(TRIM(status)) = 'entregue'
              AND data_entrega >= ${dataStart}::date
              AND data_entrega < ${dataEnd}::date
              AND COALESCE(valorp, 0) > 0
              AND responsavel IS NOT NULL AND TRIM(responsavel) != ''
            GROUP BY responsavel
          ),
          ranking AS (
            SELECT COALESCE(m.nome, p.nome) as nome,
                   COALESCE(m.mrr, 0) + COALESCE(p.pontual, 0) as valor
            FROM mrr_por_resp m
            FULL OUTER JOIN pontual_por_resp p ON m.nome = p.nome
            ORDER BY valor DESC
            LIMIT 3
          )
          SELECT
            r.nome,
            r.valor,
            COALESCE(
              NULLIF(a_id.picture, ''),
              NULLIF(a_turbo.picture, ''),
              NULLIF(a_pessoal.picture, '')
            ) as "fotoUrl",
            p.cargo
          FROM ranking r
          LEFT JOIN "Inhire".rh_pessoal p ON LOWER(TRIM(p.nome)) = LOWER(TRIM(r.nome))
          LEFT JOIN cortex_core.auth_users a_id ON p.user_id IS NOT NULL AND p.user_id = a_id.id
          LEFT JOIN cortex_core.auth_users a_turbo ON p.email_turbo IS NOT NULL AND LOWER(TRIM(p.email_turbo)) = LOWER(TRIM(a_turbo.email))
          LEFT JOIN cortex_core.auth_users a_pessoal ON p.email_pessoal IS NOT NULL AND LOWER(TRIM(p.email_pessoal)) = LOWER(TRIM(a_pessoal.email))
          ORDER BY r.valor DESC
        `),

        // 24c. Top 3 Projetos Entregues por responsável (entregas no mês) + foto
        // COUNT(DISTINCT id_task): consolida múltiplas subtarefas (ex.: 1ª/2ª/3ª Entrega) do mesmo contrato em 1 projeto
        db.execute(sql`
          WITH ranking AS (
            SELECT
              responsavel as nome,
              COUNT(DISTINCT id_task)::int as valor
            FROM "Clickup".cup_contratos
            WHERE LOWER(TRIM(status)) = 'entregue'
              AND data_entrega >= ${dataStart}::date
              AND data_entrega < ${dataEnd}::date
              AND responsavel IS NOT NULL
              AND TRIM(responsavel) != ''
            GROUP BY responsavel
            ORDER BY valor DESC
            LIMIT 3
          )
          SELECT
            r.nome,
            r.valor,
            COALESCE(
              NULLIF(a_id.picture, ''),
              NULLIF(a_turbo.picture, ''),
              NULLIF(a_pessoal.picture, '')
            ) as "fotoUrl",
            p.cargo
          FROM ranking r
          LEFT JOIN "Inhire".rh_pessoal p ON LOWER(TRIM(p.nome)) = LOWER(TRIM(r.nome))
          LEFT JOIN cortex_core.auth_users a_id ON p.user_id IS NOT NULL AND p.user_id = a_id.id
          LEFT JOIN cortex_core.auth_users a_turbo ON p.email_turbo IS NOT NULL AND LOWER(TRIM(p.email_turbo)) = LOWER(TRIM(a_turbo.email))
          LEFT JOIN cortex_core.auth_users a_pessoal ON p.email_pessoal IS NOT NULL AND LOWER(TRIM(p.email_pessoal)) = LOWER(TRIM(a_pessoal.email))
          ORDER BY r.valor DESC
        `),
      ]);

      // Build closer photo map
      const photoMap: Record<string, string> = {};
      (closerPhotosResult.rows as any[]).forEach((row: any) => {
        if (row.picture && row.name) photoMap[row.name] = row.picture;
      });

      // Build actuals map with proper quarter aggregation
      const actualsGrouped: Record<string, number[]> = {};
      (actualsResult.rows as any[]).forEach((row: any) => {
        const key = row.metric_key;
        if (!actualsGrouped[key]) actualsGrouped[key] = [];
        actualsGrouped[key].push(parseFloat(row.actual_value) || 0);
      });

      // Compute actuals from existing data for all KRs
      const qSales = (quarterSalesResult.rows as any[])[0] || {};
      const computedActuals: Record<string, number> = {};
      const qMrr = parseFloat(qSales.vendas_mrr) || 0;
      const qPont = parseFloat(qSales.vendas_pontual) || 0;
      if (qMrr > 0) computedActuals["vendas_mrr"] = qMrr;
      if (qPont > 0) computedActuals["vendas_pontual"] = qPont;

      // faturamento_legado: sum of monthly values in the quarter
      const fatSum = (okrFaturamentoResult.rows as any[]).reduce((s: number, r: any) => s + (parseFloat(r.valor) || 0), 0);
      if (fatSum > 0) computedActuals["faturamento_legado"] = fatSum;

      // churn_brl: sum of monthly churn in the quarter
      const churnSum = (okrChurnResult.rows as any[]).reduce((s: number, r: any) => s + (parseFloat(r.valor) || 0), 0);
      if (churnSum > 0) computedActuals["churn_brl"] = churnSum;

      // projetos_tech: sum of valor_p entregues in the quarter
      const techSum = (okrTechResult.rows as any[]).reduce((s: number, r: any) => s + (parseFloat(r.valor) || 0), 0);
      if (techSum > 0) computedActuals["projetos_tech"] = techSum;

      // inadimplencia_brl: sum of overdue unpaid in the quarter
      const inadSum = (okrInadResult.rows as any[]).reduce((s: number, r: any) => s + (parseFloat(r.valor) || 0), 0);
      if (inadSum > 0) computedActuals["inadimplencia_brl"] = inadSum;

      // faturamento_por_pessoa: faturamento / headcount (avg per month)
      const headcount = parseInt((okrHeadcountResult.rows as any[])[0]?.total) || 1;
      const fatMonths = (okrFaturamentoResult.rows as any[]).length || 1;
      const fatAvgPerMonth = fatSum / fatMonths;
      if (fatAvgPerMonth > 0) computedActuals["faturamento_por_pessoa"] = fatAvgPerMonth / headcount;

      // entregas_no_prazo_pct: % projects delivered on time
      const prazoRow = (okrPrazoResult.rows as any[])[0] || {};
      const prazoTotal = parseInt(prazoRow.total) || 0;
      const prazoNoPrazo = parseInt(prazoRow.no_prazo) || 0;
      if (prazoTotal > 0) computedActuals["entregas_no_prazo_pct"] = (prazoNoPrazo / prazoTotal) * 100;

      // Build OKR objectives with KRs (O1 and O2)
      const okrObjectives = objectives
        .filter(o => o.id === "O1" || o.id === "O2")
        .map(obj => {
          const objKrs = krs
            .filter(kr => kr.objectiveId === obj.id)
            .map(kr => {
              const targetQ = kr.targets[quarter] || 0;

              // Aggregate stored actuals based on KR aggregation type
              let actual: number | null = null;
              const storedValues = actualsGrouped[kr.metricKey];
              if (storedValues && storedValues.length > 0) {
                switch (kr.aggregation) {
                  case "quarter_sum": actual = storedValues.reduce((a, b) => a + b, 0); break;
                  case "quarter_avg": actual = storedValues.reduce((a, b) => a + b, 0) / storedValues.length; break;
                  case "quarter_end": actual = storedValues[storedValues.length - 1]; break;
                  case "quarter_max": actual = Math.max(...storedValues); break;
                  case "quarter_min": actual = Math.min(...storedValues); break;
                  default: actual = storedValues.reduce((a, b) => a + b, 0); break;
                }
              }

              // Override with computed actuals from crm_deal if available
              if (computedActuals[kr.metricKey] !== undefined) {
                actual = computedActuals[kr.metricKey];
              }

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

      // Build SDR photo map
      const sdrPhotoMap: Record<string, string> = {};
      (sdrPhotosResult.rows as any[]).forEach((row: any) => {
        if (row.picture && row.name) sdrPhotoMap[row.name] = row.picture;
      });

      // Build SDR ranking with photos
      const rankingSDRs = (rankingSdrResult.rows as any[]).map((row: any) => ({
        name: row.name,
        fotoUrl: sdrPhotoMap[row.name] || null,
        mrrGerado: parseFloat(row.mrr_gerado) || 0,
        pontualGerado: parseFloat(row.pontual_gerado) || 0,
        totalGerado: parseFloat(row.total_gerado) || 0,
        negociosGanhos: parseInt(row.negocios_ganhos) || 0,
      }));

      // Top SDR by meetings
      const topReunioesRow = (sdrReunioesResult.rows as any[])[0];
      const topReunioes = topReunioesRow ? {
        name: topReunioesRow.name,
        fotoUrl: sdrPhotoMap[topReunioesRow.name] || null,
        reunioes: parseInt(topReunioesRow.reunioes) || 0,
      } : null;

      // Build contracts data (single month)
      const contratosRow = (graficoResult.rows as any[])[0] || {};
      const totalRecorrente = parseFloat(contratosRow.receita_recorrente) || 0;
      const totalPontual = parseFloat(contratosRow.receita_pontual) || 0;
      const totalContratosRec = parseInt(contratosRow.contratos_recorrente) || 0;
      const totalContratosPont = parseInt(contratosRow.contratos_pontual) || 0;
      const numContratos = totalContratosRec + totalContratosPont;

      // Build turbo metrics
      const turboMrr = (turboMrrResult.rows as any[])[0] || {};
      const turboClientes = (turboClientesResult.rows as any[])[0] || {};
      const turboChurn = (turboChurnResult.rows as any[])[0] || {};
      const turboCxcs = (turboCxcsResult.rows as any[])[0] || {};
      const turboFat = (turboFaturamentoResult.rows as any[])[0] || {};

      const turboRetencoes = (turboRetencoesResult.rows as any[])[0] || {};
      const indicacoesRow = (indicacoesResult.rows as any[])[0] || {};

      const pipelineBreakdown = (pipelineBreakdownResult.rows as any[]).map((row: any) => ({
        pipeline: row.pipeline,
        contratos: parseInt(row.contratos) || 0,
        receitaRecorrente: parseFloat(row.receita_recorrente) || 0,
        receitaPontual: parseFloat(row.receita_pontual) || 0,
      }));

      const indicacoes = {
        indicacoesRecebidas: parseInt(indicacoesRow.indicacoes_recebidas) || 0,
        contratosFechados: parseInt(indicacoesRow.contratos_fechados) || 0,
        valorRecorrente: parseFloat(indicacoesRow.valor_recorrente) || 0,
        valorPontual: parseFloat(indicacoesRow.valor_pontual) || 0,
      };

      const mrrAdicionado = totalRecorrente; // from deals won this month
      // Meta de churn máximo mensal = 8% do MRR ativo do último dia do mês anterior
      const mrrMesAnteriorTotal = parseFloat((mrrAnteriorTotalResult.rows as any[])[0]?.mrr_total) || 0;
      const churnMetaMensal = mrrMesAnteriorTotal * 0.08;

      // Build receita x churn series
      const MESES_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const receitaChurnSeries = (receitaChurnResult.rows as any[]).map((row: any) => {
        const mrr = parseFloat(row.mrr) || 0;
        const pontual = parseFloat(row.pontual) || 0;
        const churnBrl = parseFloat(row.churn_brl) || 0;
        const monthNum = parseInt(row.month.split("-")[1]) - 1;
        return {
          month: row.month,
          label: MESES_SHORT[monthNum] || row.month,
          mrr,
          pontual,
          churnBrl,
          churnPct: mrr > 0 ? Math.round((churnBrl / mrr) * 1000) / 10 : 0,
        };
      });

      const turboMetrics = {
        mrrAtivo: parseFloat(turboMrr.mrr_ativo) || 0,
        ticketMedioContrato: parseFloat(turboMrr.ticket_medio_contrato) || 0,
        ticketMedioCliente: (parseInt(turboMrr.clientes_ativos) || 0) > 0
          ? (parseFloat(turboMrr.mrr_ativo) || 0) / (parseInt(turboMrr.clientes_ativos) || 1)
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
        cxcsSolicitacoes: parseInt(turboCxcs.solicitacoes) || 0,
        crosssellContratos: parseInt(turboCxcs.solicitacoes) || 0,
        crosssellPorCloser: (crosssellPorCloserResult.rows as any[]).map((row: any) => ({
          nome: row.nome,
          mrr: parseFloat(row.mrr) || 0,
          pontual: parseFloat(row.pontual) || 0,
          contratos: parseInt(row.contratos) || 0,
        })),
        faturamentoPontual: parseFloat(turboFat.faturamento_pontual) || 0,
        pontualCommerceQtr: parseFloat((pontualCommerceQtrResult.rows as any[])[0]?.pontual_commerce_qtr) || 0,
        churnMetaMensal,
        receitaChurnSeries,
        retencoesSolicitacoesCount: parseInt(turboRetencoes.solicitacoes_count) || 0,
        retencoesSolicitacoesValor: parseFloat(turboRetencoes.solicitacoes_valor) || 0,
        retencoesCount: parseInt(turboRetencoes.retencoes_count) || 0,
        retencoesValor: parseFloat(turboRetencoes.retencoes_valor) || 0,
      };

      // Normaliza nome de squad p/ casar fontes diferentes (emoji, sufixo "(OFF)", caixa)
      // — ex.: snapshot tem "✨ Aura" e cup_churn "✨ Aura (OFF)" após desativação do squad
      const normalizeSquadName = (s: string): string =>
        (s || "").replace(/^[^A-Za-z]+/, "").replace(/\s*\(OFF\)\s*$/i, "").trim().toLowerCase();

      // Pontual entregue no mês por squad (cup_contratos.data_entrega no mês)
      // Substitui o "pontual" vindo do snapshot (que era backlog em aberto)
      const pontualEntregueBySquad: Record<string, number> = {};
      (pontualEntregueSquadResult.rows as any[]).forEach((row: any) => {
        const key = normalizeSquadName(row.squad);
        pontualEntregueBySquad[key] = (pontualEntregueBySquad[key] || 0) + (parseFloat(row.pontual) || 0);
      });

      // Build ranking squads — ordena por (mrr + pontual entregue no mês) desc
      const rankingSquads = (rankingSquadsResult.rows as any[])
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

      // Build squad details (merge ranking + churn + evolução)
      const churnBySquad: Record<string, { brl: number; count: number; totalBrl: number; totalCount: number; clientes: any[] }> = {};
      (churnSquadsResult.rows as any[]).forEach((row: any) => {
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
      (mrrAnteriorSquadsResult.rows as any[]).forEach((row: any) => {
        const key = normalizeSquadName(row.squad);
        mrrAnteriorBySquad[key] = (mrrAnteriorBySquad[key] || 0) + (parseFloat(row.mrr) || 0);
      });

      // Squads ocultos do slide "Detalhes por Squad" (não impacta ranking nem totais)
      const SQUADS_OCULTOS_DETALHES = new Set(["comercial", "makers", "turbo interno", "squad x"]);

      const vendasExpansaoMes = VENDAS_EXPANSAO_POR_MES[`${anoDados}-${String(mesDados).padStart(2, "0")}`] || {};

      const squadDetails = (rankingSquadsResult.rows as any[])
        .filter((row: any) => !SQUADS_OCULTOS_DETALHES.has(normalizeSquadName(row.squad)))
        .map((row: any) => {
        const mrr = parseFloat(row.mrr) || 0;
        const pontual = pontualEntregueBySquad[normalizeSquadName(row.squad)] || 0;  // pontual entregue no mês (não em aberto)
        const contratos = parseInt(row.contratos) || 0;
        const clientes = parseInt(row.clientes) || 0;
        const churn = churnBySquad[normalizeSquadName(row.squad)] || { brl: 0, count: 0, totalBrl: 0, totalCount: 0, clientes: [] };
        const mrrAnt = mrrAnteriorBySquad[normalizeSquadName(row.squad)] || 0;
        const ticketMedio = contratos > 0 ? mrr / contratos : 0;
        // Churn % = churn do mês / MRR do mês anterior.
        // Squad novo (sem base no mês anterior): usa MRR do próprio mês como base.
        const churnBase = mrrAnt > 0 ? mrrAnt : mrr;
        const churnPct = churnBase > 0 ? (churn.brl / churnBase) * 100 : 0;
        const churnTotalPct = churnBase > 0 ? (churn.totalBrl / churnBase) * 100 : 0;
        // NRR = churn s/ abonados − abatimento da expansão (pode ficar negativo = retenção líquida positiva)
        const vendaExpansao = vendasExpansaoMes[normalizeSquadName(row.squad)];
        const vendasMes = vendaExpansao?.vendas || 0;
        const expansaoNrr = vendaExpansao?.abatimento || 0;
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

      // Build tech data
      const techKpisEntregues = (techKpisEntreguesResult.rows as any[])[0] || {};
      const techKpisAdicionados = (techKpisAdicionadosResult.rows as any[])[0] || {};

      const techKpis = {
        entregues: parseInt(techKpisEntregues.entregues) || 0,
        valorEntregues: parseFloat(techKpisEntregues.valor_entregues) || 0,
        tempoMedio: Math.round(parseFloat(techKpisEntregues.tempo_medio) || 0),
        adicionados: parseInt(techKpisAdicionados.adicionados) || 0,
        valorAdicionados: parseFloat(techKpisAdicionados.valor_adicionados) || 0,
      };

      // Pivot entregas por tipo/mês for Recharts
      const allTipos = new Set<string>();
      const entregasByMonth: Record<string, Record<string, number>> = {};
      const receitaByMonth: Record<string, Record<string, number>> = {};

      (techEntregasPorTipoResult.rows as any[]).forEach((row: any) => {
        const tipo = row.tipo || "Outros";
        allTipos.add(tipo);
        if (!entregasByMonth[row.month]) entregasByMonth[row.month] = {};
        if (!receitaByMonth[row.month]) receitaByMonth[row.month] = {};
        entregasByMonth[row.month][tipo] = parseInt(row.entregas) || 0;
        receitaByMonth[row.month][tipo] = parseFloat(row.receita) || 0;
      });

      const tiposList = Array.from(allTipos);

      // Build month arrays (jan do ano até mesDados)
      const tech12Months: { key: string; label: string }[] = [];
      for (let m = 1; m <= mesDados; m++) {
        const key = `${anoDados}-${String(m).padStart(2, '0')}`;
        const label = MESES_SHORT[m - 1];
        tech12Months.push({ key, label });
      }

      const techEntregasPorTipo = tech12Months.map(({ key, label }) => {
        const entry: Record<string, any> = { month: key, label };
        tiposList.forEach(t => { entry[t] = entregasByMonth[key]?.[t] || 0; });
        return entry;
      });

      const techReceitaPorTipo = tech12Months.map(({ key, label }) => {
        const entry: Record<string, any> = { month: key, label };
        tiposList.forEach(t => { entry[t] = receitaByMonth[key]?.[t] || 0; });
        return entry;
      });

      const techEmAbertoPorTipo = (techEmAbertoResult.rows as any[]).map((row: any) => ({
        tipo: row.tipo || "Outros",
        quantidade: parseInt(row.quantidade) || 0,
        valor: parseFloat(row.valor) || 0,
      }));

      // Pipeline status order (natural flow)
      const PIPELINE_ORDER = [
        'não iniciado', 'kickoff', 'pronto p/ design', 'design', 'design review',
        'pronto p/ dev', 'dev', 'dev review', 'pronto para lançar', 'bloqueado',
      ];
      const pipelineRaw = (techPipelineResult.rows as any[]).map((row: any) => ({
        status: row.status,
        quantidade: parseInt(row.quantidade) || 0,
      }));
      // Sort by pipeline order, unknown statuses at the end
      const techPipeline = pipelineRaw
        .filter((p: any) => p.status !== 'pausado')
        .sort((a: any, b: any) => {
          const ia = PIPELINE_ORDER.indexOf(a.status);
          const ib = PIPELINE_ORDER.indexOf(b.status);
          return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        });

      const techData = {
        kpis: techKpis,
        mesLabel: mesDadosLabel,
        entregasPorTipo: techEntregasPorTipo,
        receitaPorTipo: techReceitaPorTipo,
        emAbertoPorTipo: techEmAbertoPorTipo,
        pipeline: techPipeline,
      };

      // Build pontualData (slide Pontual)
      // Override manual: "Creators" valor em aberto (corrigido devido a duplicação nas entregas parceladas)
      const CREATORS_OVERRIDE_VALOR = 711406;
      const emAbertoPorServico = (pontualEmAbertoResult.rows as any[])
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

      const aquisicaoRow = (pontualAquisicaoResult.rows as any[])[0] || {};
      // Override manual: aquisição de Março/2026 corrigida (valor validado manualmente)
      const aquisicaoValor = mesParam === '2026-03'
        ? 792766
        : (parseFloat(aquisicaoRow.valor) || 0);
      const aquisicaoContratos = parseInt(aquisicaoRow.contratos) || 0;

      const entregasPorSquad = (pontualEntregasSquadResult.rows as any[]).map((row: any) => ({
        squad: row.squad,
        valor: parseFloat(row.valor) || 0,
        contratos: parseInt(row.contratos) || 0,
      }));
      const entregasSquadTotal = entregasPorSquad.reduce((s, r) => s + r.valor, 0);

      // Agrupar entregas por produto x mês em formato { month, label, produtos: { ... }, total }
      const entregasProdutoMesMap = new Map<string, { label: string; produtos: Record<string, number>; total: number }>();
      for (const row of pontualEntregasProdutoMesResult.rows as any[]) {
        const month = row.month as string;
        const produto = row.produto as string;
        const valor = parseFloat(row.valor) || 0;
        if (!entregasProdutoMesMap.has(month)) {
          const mNum = parseInt(month.split("-")[1]) - 1;
          entregasProdutoMesMap.set(month, {
            label: MESES_SHORT[mNum] || month,
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

      const tempoMedioEntrega = (pontualTempoMedioResult.rows as any[]).map((row: any) => ({
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
        variacaoEstoque: {
          entrou: aquisicaoValor,
          saiu: entregasSquadTotal,
          delta: aquisicaoValor - entregasSquadTotal,
        },
        entregasPorProdutoMes,
        tempoMedioEntrega,
      };

      // ── Faturamento YTD ──
      const ytdRow = (faturamentoYtdResult.rows as any[])[0] || {};
      const faturamentoBrutoYtd = parseFloat(ytdRow.faturamento_bruto_ytd) || 0;
      const inadimplenciaYtd = parseFloat(ytdRow.inadimplencia_ytd) || 0;

      let impostoYtd = 0;
      const dfcRecebimentoMensal = (dfcRecebimentoYtdResult.rows as any[]).map((row: any) => {
        const m = parseInt(row.month.split("-")[1]) - 1;
        impostoYtd += parseFloat(row.imposto) || 0;
        return {
          month: row.month as string,
          label: MESES_SHORT[m] || row.month,
          recebido: parseFloat(row.recebido) || 0,
        };
      });

      const faturamentoYtd = {
        faturamentoBrutoYtd,
        inadimplenciaYtd,
        impostoYtd,
        dfcRecebimentoMensal,
      };

      const topOperadores = {
        topMrr: (topMrrResult.rows as any[]).map((row: any) => ({
          nome: row.nome as string,
          valor: parseFloat(row.valor) || 0,
          fotoUrl: row.fotoUrl || null,
          cargo: row.cargo || null,
        })),
        topMrrPontual: (topMrrPontualResult.rows as any[]).map((row: any) => ({
          nome: row.nome as string,
          valor: parseFloat(row.valor) || 0,
          fotoUrl: row.fotoUrl || null,
          cargo: row.cargo || null,
        })),
        topEntregas: (topEntregasResult.rows as any[]).map((row: any) => ({
          nome: row.nome as string,
          valor: parseInt(row.valor) || 0,
          fotoUrl: row.fotoUrl || null,
          cargo: row.cargo || null,
        })),
      };

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
        rankingSDRs,
        topReunioes,
        contratosMes: {
          numContratos,
          contratosRecorrente: totalContratosRec,
          contratosPontual: totalContratosPont,
          receitaRecorrente: totalRecorrente,
          receitaPontual: totalPontual,
          tmRecorrente: totalContratosRec > 0 ? totalRecorrente / totalContratosRec : 0,
          tmPontual: totalContratosPont > 0 ? totalPontual / totalContratosPont : 0,
          pipelineBreakdown,
          vendasSeries: (vendasSeriesResult.rows as any[]).map((row: any) => {
            const [y, m] = row.month.split("-").map(Number);
            return {
              month: row.month,
              label: MESES_SHORT[m - 1],
              vendasMrr: parseFloat(row.vendas_mrr) || 0,
              vendasPontual: parseFloat(row.vendas_pontual) || 0,
              numContratos: parseInt(row.num_contratos) || 0,
            };
          }),
        },
        turboMetrics,
        rankingSquads,
        squadDetails,
        techData,
        indicacoes,
        pontualData,
        faturamentoYtd,
        topOperadores,
      });

    } catch (error: any) {
      console.error("[reports/mensal] Error:", error?.message || error);
      res.status(500).json({ error: "Erro ao gerar dados do reporte mensal", details: error?.message });
    }
  });
}

import type { Express } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

export function registerJuridicoRelatoriosRoutes(app: Express) {
  /**
   * GET /api/juridico/relatorios
   * Query params:
   *   tipo: "resumo" | "inadimplencia" | "processos" | "contratos"
   *   periodo: "YYYY-MM" (used for filtering acordos in resumo)
   */
  app.get("/api/juridico/relatorios", async (req, res) => {
    const { tipo, periodo } = req.query as { tipo?: string; periodo?: string };

    if (!tipo || !["resumo", "inadimplencia", "processos", "contratos"].includes(tipo)) {
      return res.status(400).json({
        error: "Parâmetro 'tipo' é obrigatório. Valores aceitos: resumo, inadimplencia, processos, contratos",
      });
    }

    try {
      switch (tipo) {
        case "resumo":
          return res.json(await handleResumo(periodo));
        case "inadimplencia":
          return res.json(await handleInadimplencia());
        case "processos":
          return res.json(await handleProcessos());
        case "contratos":
          return res.json(await handleContratos());
        default:
          return res.status(400).json({ error: "Tipo inválido" });
      }
    } catch (err) {
      console.error(`[juridico-relatorios] Erro ao processar tipo=${tipo}:`, err);
      return res.status(500).json({ error: "Erro interno ao gerar relatório" });
    }
  });
}

// ── Resumo ──────────────────────────────────────────────────────────────────────

async function handleResumo(periodo?: string) {
  try {
    // KPI: Total inadimplentes
    const [inadimplentesRow] = await db.execute(sql`
      SELECT COUNT(*)::int AS total FROM juridico_clientes
    `);
    const totalInadimplentes = inadimplentesRow?.total ?? 0;

    // KPI: Valor em risco (parcelas vencidas)
    const [valorRiscoRow] = await db.execute(sql`
      SELECT COALESCE(SUM(valor), 0)::numeric AS total
      FROM "Conta Azul".caz_parcelas
      WHERE status = 'VENCIDO'
    `);
    const valorEmRisco = Number(valorRiscoRow?.total ?? 0);

    // KPI: Acordos fechados no período
    let acordosFechados = 0;
    if (periodo) {
      const [year, month] = periodo.split("-").map(Number);
      const inicioMes = `${year}-${String(month).padStart(2, "0")}-01`;
      const proximoMes = month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, "0")}-01`;

      const [acordosRow] = await db.execute(sql`
        SELECT COUNT(*)::int AS total FROM juridico_clientes
        WHERE procedimento = 'acordo'
          AND data_atualizacao >= ${inicioMes}::date
          AND data_atualizacao < ${proximoMes}::date
      `);
      acordosFechados = acordosRow?.total ?? 0;
    }

    // KPI: Taxa de recuperação
    const taxaRecuperacao = totalInadimplentes > 0
      ? Math.round((acordosFechados / totalInadimplentes) * 10000) / 100
      : 0;

    // KPI: Processos ativos
    const [processosRow] = await db.execute(sql`
      SELECT COUNT(*)::int AS total FROM cortex_core.juridico_processos WHERE status = 'Ativo'
    `);
    const processosAtivos = processosRow?.total ?? 0;

    // KPI: Valor processos ativos
    const [valorProcessosRow] = await db.execute(sql`
      SELECT COALESCE(SUM(valor_causa), 0)::numeric AS total
      FROM cortex_core.juridico_processos WHERE status = 'Ativo'
    `);
    const valorProcessos = Number(valorProcessosRow?.total ?? 0);

    // Evolução mensal (últimos 12 meses)
    const evolucaoMensal = await db.execute(sql`
      SELECT
        TO_CHAR(p.data_vencimento, 'YYYY-MM') AS mes,
        TO_CHAR(p.data_vencimento, 'Mon/YY') AS "mesLabel",
        COUNT(DISTINCT p.cnpj_cliente)::int AS "qtdInadimplentes",
        COALESCE(SUM(p.valor), 0)::numeric AS "valorRisco"
      FROM "Conta Azul".caz_parcelas p
      WHERE p.status = 'VENCIDO'
        AND p.data_vencimento >= NOW() - INTERVAL '12 months'
      GROUP BY TO_CHAR(p.data_vencimento, 'YYYY-MM'), TO_CHAR(p.data_vencimento, 'Mon/YY')
      ORDER BY mes
    `);

    // Por procedimento
    const porProcedimento = await db.execute(sql`
      SELECT COALESCE(procedimento, 'sem_procedimento') AS procedimento, COUNT(*)::int AS total
      FROM juridico_clientes GROUP BY procedimento ORDER BY total DESC
    `);

    // Por status
    const porStatus = await db.execute(sql`
      SELECT COALESCE(status_juridico, 'sem_status') AS status_juridico, COUNT(*)::int AS total
      FROM juridico_clientes GROUP BY status_juridico ORDER BY total DESC
    `);

    return {
      kpis: {
        totalInadimplentes,
        valorEmRisco,
        acordosFechados,
        taxaRecuperacao,
        processosAtivos,
        valorProcessos,
      },
      evolucaoMensal,
      porProcedimento,
      porStatus,
    };
  } catch (err) {
    console.error("[juridico-relatorios] Erro no resumo:", err);
    throw err;
  }
}

// ── Inadimplência ───────────────────────────────────────────────────────────────

async function handleInadimplencia() {
  try {
    const lista = await db.execute(sql`
      SELECT
        jc.cliente_id AS "clienteId",
        jc.procedimento,
        jc.status_juridico AS "statusJuridico",
        jc.valor_acordado AS "valorAcordado",
        jc.observacoes,
        jc.advogado_responsavel AS "advogadoResponsavel",
        jc.data_atualizacao AS "dataAtualizacao",
        agg.nome_cliente AS "nomeCliente",
        agg.cnpj_cliente AS "cnpjCliente",
        agg.valor_total AS "valorTotal",
        agg.dias_atraso_max AS "diasAtrasoMax"
      FROM juridico_clientes jc
      LEFT JOIN LATERAL (
        SELECT
          nome_cliente,
          cnpj_cliente,
          COALESCE(SUM(valor), 0)::numeric AS valor_total,
          COALESCE(MAX(CURRENT_DATE - data_vencimento), 0)::int AS dias_atraso_max
        FROM "Conta Azul".caz_parcelas
        WHERE id_cliente = jc.cliente_id AND status = 'VENCIDO'
        GROUP BY nome_cliente, cnpj_cliente
      ) agg ON true
      ORDER BY agg.dias_atraso_max DESC NULLS LAST
    `);

    return { lista };
  } catch (err) {
    console.error("[juridico-relatorios] Erro na inadimplência:", err);
    throw err;
  }
}

// ── Processos ───────────────────────────────────────────────────────────────────

async function handleProcessos() {
  try {
    // KPIs
    const [kpisRow] = await db.execute(sql`
      SELECT
        COUNT(*)::int AS "totalProcessos",
        COUNT(*) FILTER (WHERE status = 'Ativo')::int AS "processosAtivos",
        COALESCE(SUM(valor_causa), 0)::numeric AS "valorTotalRisco",
        COALESCE(SUM(valor_causa) FILTER (WHERE status = 'Ativo'), 0)::numeric AS "valorRiscoAtivo"
      FROM cortex_core.juridico_processos
    `);

    const kpis = {
      totalProcessos: kpisRow?.totalProcessos ?? 0,
      processosAtivos: kpisRow?.processosAtivos ?? 0,
      valorTotalRisco: Number(kpisRow?.valorTotalRisco ?? 0),
      valorRiscoAtivo: Number(kpisRow?.valorRiscoAtivo ?? 0),
    };

    // Por natureza
    const porNatureza = await db.execute(sql`
      SELECT
        COALESCE(natureza_acao, 'Não informada') AS natureza,
        COUNT(*)::int AS quantidade,
        COALESCE(SUM(valor_causa), 0)::numeric AS valor
      FROM cortex_core.juridico_processos
      GROUP BY natureza_acao
      ORDER BY quantidade DESC
    `);

    // Por status
    const porStatus = await db.execute(sql`
      SELECT
        COALESCE(status, 'Não informado') AS status,
        COUNT(*)::int AS quantidade
      FROM cortex_core.juridico_processos
      GROUP BY status
      ORDER BY quantidade DESC
    `);

    // Lista de processos
    const lista = await db.execute(sql`
      SELECT
        id,
        numero_cnj AS "numeroCnj",
        cliente_principal AS "clientePrincipal",
        status,
        natureza_acao AS "naturezaAcao",
        comarca,
        valor_causa AS "valorCausa",
        data_distribuicao AS "dataDistribuicao"
      FROM cortex_core.juridico_processos
      ORDER BY criado_em DESC
    `);

    return { kpis, porNatureza, porStatus, lista };
  } catch (err) {
    console.error("[juridico-relatorios] Erro nos processos:", err);
    throw err;
  }
}

// ── Contratos ───────────────────────────────────────────────────────────────────

async function handleContratos() {
  try {
    const [kpisRow] = await db.execute(sql`
      SELECT
        COUNT(*)::int AS "totalContratos",
        COUNT(*) FILTER (WHERE status = 'ativo' OR status = 'vigente')::int AS "contratosAtivos"
      FROM cortex_core.colaboradores_contratos
    `);

    return {
      kpis: {
        totalContratos: kpisRow?.totalContratos ?? 0,
        contratosAtivos: kpisRow?.contratosAtivos ?? 0,
      },
    };
  } catch (err) {
    console.error("[juridico-relatorios] Erro nos contratos (tabela pode não existir):", err);
    return {
      kpis: {
        totalContratos: 0,
        contratosAtivos: 0,
      },
    };
  }
}

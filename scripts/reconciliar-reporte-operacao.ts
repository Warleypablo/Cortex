/**
 * Reconciliação da tela /reports/operacao contra PRODUÇÃO.
 *
 * Chama os módulos REAIS (as mesmas funções que o endpoint usa) apontados ao
 * banco de produção e confere cada número contra SQL independente escrito aqui.
 * Não replica a lógica do app — se replicasse, os dois lados errariam juntos.
 *
 * Uso: npx tsx scripts/reconciliar-reporte-operacao.ts
 */
import "dotenv/config";

// As credenciais precisam ser trocadas ANTES do import de server/db, porque o
// Pool lê process.env no momento em que o módulo é avaliado.
const senhaProd = (process.env.DB_PASSWORD_PROD || "").trim();
if (!senhaProd) {
  console.error(
    "Defina DB_PASSWORD_PROD no ambiente antes de rodar (a senha está no bloco comentado do .env).",
  );
  process.exit(1);
}
process.env.DB_HOST = "34.95.249.110";
process.env.DB_PORT = "5432";
process.env.DB_NAME = "dados_turbo";
process.env.DB_USER = "postgres";
process.env.DB_PASSWORD = senhaProd;
process.env.DB_SSL = "true";

async function main() {
  const { db } = await import("../server/db");
  const { sql } = await import("drizzle-orm");
  const { parSemanas, hojeSP } = await import("../server/reportsSemanal/semanas");
  const { carteiraNoFim, baseNaAbertura, entregaPontualNaSemana, churnMrrNaSemana, churnPontualNaSemana } =
    await import("../server/reportsSemanal/queries");
  const {
    estoquePontualNoFim,
    estoquePontualPorProduto,
    churnPorMotivoNaSemana,
    headcountOperacao,
    detalheChurnPorAbono,
    detalheEstoquePontual,
    detalheChurnDoMotivo,
  } = await import("../server/reportsSemanal/queriesOperacao");
  const { derivarOperacao, compararOperacao } = await import("../server/reportsSemanal/derivarOperacao");

  const num = (v: unknown) => {
    const n = parseFloat(String(v));
    return Number.isFinite(n) ? n : 0;
  };
  const brl = (v: number | null) =>
    v === null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  let falhas = 0;
  const conferir = (rotulo: string, app: number | null, esperado: number | null, tol = 0.5) => {
    const ok =
      app === null || esperado === null
        ? app === esperado
        : Math.abs(app - esperado) <= tol;
    if (!ok) falhas++;
    console.log(
      `  ${ok ? "OK  " : "FALHA"} ${rotulo.padEnd(38)} app=${String(brl(app)).padStart(16)}  sql=${String(brl(esperado)).padStart(16)}`,
    );
  };

  const { atual, anterior } = parSemanas(hojeSP());
  console.log(`\nPar comparado: ${atual.inicio}..${atual.fim}  ×  ${anterior.inicio}..${anterior.fim}\n`);

  for (const semana of [atual, anterior]) {
    console.log(`── Semana ${semana.inicio} a ${semana.fim} ──`);

    // Camada do app (as mesmas funções do endpoint)
    const [carteira, base, entrega, churnMrr, churnPontual, estoque, porProduto, porMotivo, headcount] =
      await Promise.all([
        carteiraNoFim(db, semana.fim),
        baseNaAbertura(db, semana.inicio),
        entregaPontualNaSemana(db, semana.inicio, semana.fim),
        churnMrrNaSemana(db, semana.inicio, semana.fim),
        churnPontualNaSemana(db, semana.inicio, semana.fim),
        estoquePontualNoFim(db, semana.fim),
        estoquePontualPorProduto(db, semana.fim),
        churnPorMotivoNaSemana(db, semana.inicio, semana.fim),
        headcountOperacao(db, semana.fim),
      ]);

    const m = derivarOperacao({
      semana,
      carteira,
      base,
      entregaPontual: entrega,
      estoquePontual: estoque,
      estoquePorProduto: porProduto,
      churnMrr,
      churnPontual,
      churnPorMotivo: porMotivo,
      headcountOperacao: headcount,
      faturavelMes: null, // fora do escopo desta reconciliação (vem do BP, com cache)
    });

    // SQL independente, escrito do zero
    const r: any = await db.execute(sql`
      WITH fim AS (SELECT MAX(data_snapshot) d FROM "Clickup".cup_data_hist WHERE data_snapshot <= ${semana.fim}::date),
           ini AS (SELECT MAX(data_snapshot) d FROM "Clickup".cup_data_hist WHERE data_snapshot < ${semana.inicio}::date)
      SELECT
        (SELECT COALESCE(SUM(h.valorr::numeric),0) FROM "Clickup".cup_data_hist h, fim
           WHERE h.data_snapshot = fim.d AND h.status IN ('triagem','onboarding','ativo')) AS mrr_ativo,
        (SELECT COALESCE(SUM(h.valorr::numeric),0) FROM "Clickup".cup_data_hist h, fim
           WHERE h.data_snapshot = fim.d AND h.status IN ('triagem','onboarding','ativo','em cancelamento')) AS mrr_operando,
        (SELECT COALESCE(SUM(h.valorr::numeric),0) FROM "Clickup".cup_data_hist h, ini
           WHERE h.data_snapshot = ini.d AND h.status IN ('triagem','onboarding','ativo')) AS base_mrr,
        (SELECT COALESCE(SUM(h.valorp::numeric),0) FROM "Clickup".cup_data_hist h, ini
           WHERE h.data_snapshot = ini.d AND h.valorp > 0
             AND h.status NOT IN ('entregue','cancelado/inativo','não usar')) AS base_pontual,
        (SELECT COALESCE(SUM(h.valorp::numeric),0) FROM "Clickup".cup_data_hist h, fim
           WHERE h.data_snapshot = fim.d AND h.valorp > 0
             AND h.status NOT IN ('entregue','cancelado/inativo','não usar')) AS estoque_fim,
        (SELECT COALESCE(SUM(valor_r),0) FROM "Clickup".cup_churn
           WHERE data_solicitacao_encerramento BETWEEN ${semana.inicio}::date AND ${semana.fim}::date) AS churn_mrr_total,
        (SELECT COALESCE(SUM(valor_r),0) FROM "Clickup".cup_churn
           WHERE data_solicitacao_encerramento BETWEEN ${semana.inicio}::date AND ${semana.fim}::date
             AND COALESCE(abonar_churn,'') = 'Sim') AS churn_mrr_abonado,
        (SELECT COALESCE(SUM(ct.valorp),0) FROM "Clickup".cup_churn ch
           JOIN "Clickup".cup_contratos ct ON ct.id_subtask = ch.task_id AND ct.valorp > 0
           WHERE ch.data_solicitacao_encerramento BETWEEN ${semana.inicio}::date AND ${semana.fim}::date) AS churn_pont_total,
        (SELECT COALESCE(SUM(ct.valorp),0) FROM "Clickup".cup_churn ch
           JOIN "Clickup".cup_contratos ct ON ct.id_subtask = ch.task_id AND ct.valorp > 0
           WHERE ch.data_solicitacao_encerramento BETWEEN ${semana.inicio}::date AND ${semana.fim}::date
             AND COALESCE(ch.abonar_churn,'') = 'Sim') AS churn_pont_abonado,
        (SELECT COUNT(*) FROM "Inhire".rh_pessoal p
           WHERE p.admissao IS NOT NULL AND p.admissao <= ${semana.fim}::date
             AND (p.demissao IS NULL OR p.demissao > ${semana.fim}::date)
             AND NOT (p.demissao IS NULL AND TRIM(COALESCE(p.status,'')) = 'Dispensado')
             AND TRIM(p.setor) IN ('Commerce','Tech Sites')
             AND LOWER(TRIM(REGEXP_REPLACE(COALESCE(p.squad,''), '[^[:alnum:] &]', '', 'g'))) NOT LIKE '%vendas%') AS headcount
    `);
    const e = (r.rows ?? [])[0] as any;

    conferir("MRR Ativo", m.mrrAtivo, num(e.mrr_ativo));
    conferir("MRR Operando", m.mrrOperando, num(e.mrr_operando));
    conferir("Base MRR (abertura)", m.baseMrr, num(e.base_mrr));
    conferir("Base Pontual (abertura)", m.basePontual, num(e.base_pontual));
    conferir("Estoque Pontual (fim)", m.estoquePontual, num(e.estoque_fim));
    conferir("Churn MRR Total", m.churnMrrTotal, num(e.churn_mrr_total));
    conferir("Churn MRR Abonado", m.churnMrrAbonado, num(e.churn_mrr_abonado));
    conferir("Churn MRR Líquido", m.churnMrrLiquido, num(e.churn_mrr_total) - num(e.churn_mrr_abonado));
    conferir("Churn Pontual Total", m.churnPontualTotal, num(e.churn_pont_total));
    conferir("Churn Pontual Abonado", m.churnPontualAbonado, num(e.churn_pont_abonado));
    conferir("Churn Pontual Líquido", m.churnPontualLiquido, num(e.churn_pont_total) - num(e.churn_pont_abonado));
    conferir("Headcount Operação", m.headcountOperacao, num(e.headcount), 0);
    conferir("MRR por cabeça", m.mrrPorCabeca, num(e.mrr_ativo) / num(e.headcount), 1);

    // Invariantes internas da tela
    const somaProduto = m.estoquePorProduto.reduce((s, p) => s + p.valor, 0);
    conferir("Σ estoque por produto == total", somaProduto, m.estoquePontual);
    const somaMotivoMrr = m.churnPorMotivo.reduce((s, x) => s + x.mrr, 0);
    conferir("Σ motivos (MRR) == churn total", somaMotivoMrr, m.churnMrrTotal);
    const somaMotivoPont = m.churnPorMotivo.reduce((s, x) => s + x.pontual, 0);
    conferir("Σ motivos (pontual) == churn pont.", somaMotivoPont, m.churnPontualTotal);

    // Drills reconciliam com a célula que abrem
    const [drillAbonadoMrr, drillLiquidoMrr, drillAbonadoPont, drillLiquidoPont, drillEstoque] = await Promise.all([
      detalheChurnPorAbono(db, semana.inicio, semana.fim, { pontual: false, abonados: true }),
      detalheChurnPorAbono(db, semana.inicio, semana.fim, { pontual: false, abonados: false }),
      detalheChurnPorAbono(db, semana.inicio, semana.fim, { pontual: true, abonados: true }),
      detalheChurnPorAbono(db, semana.inicio, semana.fim, { pontual: true, abonados: false }),
      detalheEstoquePontual(db, semana.fim, null),
    ]);
    const soma = (linhas: { valor: number }[]) => linhas.reduce((s, l) => s + l.valor, 0);
    conferir("drill Churn MRR Abonado", soma(drillAbonadoMrr), m.churnMrrAbonado);
    conferir("drill Churn MRR Líquido", soma(drillLiquidoMrr), m.churnMrrLiquido);
    conferir("drill Churn Pont. Abonado", soma(drillAbonadoPont), m.churnPontualAbonado);
    conferir("drill Churn Pont. Líquido", soma(drillLiquidoPont), m.churnPontualLiquido);
    conferir("drill Estoque Pontual (total)", soma(drillEstoque), m.estoquePontual);

    // Drill de um produto e de um motivo, escolhidos por serem os maiores
    const maiorProduto = m.estoquePorProduto[0];
    if (maiorProduto) {
      const d = await detalheEstoquePontual(db, semana.fim, maiorProduto.produto);
      conferir(`drill produto "${maiorProduto.produto}"`, soma(d), maiorProduto.valor);
    }
    const maiorMotivo = [...m.churnPorMotivo].sort((a, b) => b.mrr - a.mrr)[0];
    if (maiorMotivo) {
      const d = await detalheChurnDoMotivo(db, semana.inicio, semana.fim, maiorMotivo.motivo);
      // a gêmea de motivo soma MRR + pontual do mesmo cliente
      conferir(`drill motivo "${maiorMotivo.motivo}"`, soma(d), maiorMotivo.mrr + maiorMotivo.pontual);
    }
    console.log("");
  }

  // Pareamento: nenhuma chave pode sumir na comparação das duas semanas
  const mAtual = await apurar(atual);
  const mAnterior = await apurar(anterior);
  const comp = compararOperacao(mAtual, mAnterior);
  const chavesProduto = new Set([
    ...mAtual.estoquePorProduto.map((p) => p.produto),
    ...mAnterior.estoquePorProduto.map((p) => p.produto),
  ]);
  const chavesMotivo = new Set([
    ...mAtual.churnPorMotivo.map((x) => x.motivo),
    ...mAnterior.churnPorMotivo.map((x) => x.motivo),
  ]);
  console.log("── Pareamento das duas semanas ──");
  conferir("produtos na tabela == união das 2 semanas", comp.produtos.length, chavesProduto.size, 0);
  conferir("motivos na tabela == união das 2 semanas", comp.motivos.length, chavesMotivo.size, 0);
  conferir(
    "Σ coluna atual (produtos) == estoque atual",
    comp.produtos.reduce((s, p) => s + p.atual, 0),
    mAtual.estoquePontual,
  );
  conferir(
    "Σ coluna anterior (produtos) == estoque ant.",
    comp.produtos.reduce((s, p) => s + p.anterior, 0),
    mAnterior.estoquePontual,
  );

  async function apurar(semana: any) {
    const [carteira, base, entrega, churnMrr, churnPontual, estoque, porProduto, porMotivo, headcount] =
      await Promise.all([
        carteiraNoFim(db, semana.fim),
        baseNaAbertura(db, semana.inicio),
        entregaPontualNaSemana(db, semana.inicio, semana.fim),
        churnMrrNaSemana(db, semana.inicio, semana.fim),
        churnPontualNaSemana(db, semana.inicio, semana.fim),
        estoquePontualNoFim(db, semana.fim),
        estoquePontualPorProduto(db, semana.fim),
        churnPorMotivoNaSemana(db, semana.inicio, semana.fim),
        headcountOperacao(db, semana.fim),
      ]);
    return derivarOperacao({
      semana,
      carteira,
      base,
      entregaPontual: entrega,
      estoquePontual: estoque,
      estoquePorProduto: porProduto,
      churnMrr,
      churnPontual,
      churnPorMotivo: porMotivo,
      headcountOperacao: headcount,
      faturavelMes: null,
    });
  }

  console.log(`\n${falhas === 0 ? "TODAS AS CONFERÊNCIAS RECONCILIAM." : `${falhas} CONFERÊNCIA(S) FALHARAM.`}\n`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Erro:", e);
  process.exit(1);
});

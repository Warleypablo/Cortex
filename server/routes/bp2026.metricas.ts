// server/routes/bp2026.metricas.ts
// Bloco "Métricas Gerais" (sub-aba): monta as 18 linhas a partir das séries já
// computadas do DRE + 3 consultas próprias (vendas MRR, headcount/áreas, churn, saldo).
import { sql } from "drizzle-orm";
import { calcAtingimento, calcYtd, type MesValor } from "./bp2026.helpers";

// tipos estruturais mínimos (compatíveis com bp2026.ts)
interface MesLinha extends MesValor { atingimento: number | null }
interface Linha {
  metrica: string; titulo: string; tipoAgregacao: "fluxo" | "estoque";
  direcao: "maior_melhor" | "menor_melhor" | "neutro";
  unidade?: "brl" | "int" | "pct"; nota?: string;
  meses: MesLinha[];
  ytd: { orcado: number; realizado: number | null; atingimento: number | null };
}

const NOTA_SALDO =
  "Reconstrução retroativa: saldo bancário atual menos os fluxos quitados " +
  "posteriores ao fim do mês. Não captura ajustes manuais de conta.";

const NOTA_PESSOAS =
  "Mapeamento aproximado por setor do Inhire (Commerce+Tech→CSV; Growth→CAC; " +
  "Backoffice+Sócios→SG&A) — o time comercial está dentro de Commerce, " +
  "subcontando o CAC vs o conceito do BP.";

interface Deps {
  db: any;
  orcado: Record<string, Record<number, number>>;
  // séries de realizado mensal (índice 1..12; null = sem dado)
  realizadoDre: Record<string, (number | null)[]>; // por metrica do DRE, array[12]
  mrrInfoPorMes: Record<number, { valor: number; clientes: number; contratos: number }>;
  pontualPorMes: Record<number, number>;
  dfcPorMes: Record<number, number>;
  mesCorrente: number;
  mesFechado: number;
}

function serie(realizadoDre: Record<string, (number | null)[]>, metrica: string): (number | null)[] {
  return realizadoDre[metrica] ?? Array.from({ length: 12 }, () => null);
}

function somaSeries(series: (number | null)[][]): (number | null)[] {
  return Array.from({ length: 12 }, (_, i) => {
    if (series.some((s) => s[i] === null)) return null;
    return series.reduce((acc, s) => acc + (s[i] ?? 0), 0);
  });
}

function razao(num: number | null, den: number | null): number | null {
  if (num === null || den === null || !den) return null;
  return num / den;
}

function buildLinhaGeral(
  def: { metrica: string; titulo: string; tipoAgregacao: "fluxo" | "estoque"; direcao: Linha["direcao"]; unidade: NonNullable<Linha["unidade"]>; nota?: string },
  orcado: Record<string, Record<number, number>>,
  realizado: (number | null)[],
  mesFechado: number,
  ytdOverride?: { orcado: number; realizado: number | null }
): Linha {
  const meses: MesLinha[] = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    const o = orcado[def.metrica]?.[mes] ?? 0;
    const r = realizado[i];
    return { mes, orcado: o, realizado: r, atingimento: calcAtingimento(o, r) };
  });
  let ytd: Linha["ytd"];
  if (mesFechado === 0) {
    ytd = { orcado: 0, realizado: null, atingimento: null };
  } else if (ytdOverride) {
    ytd = { ...ytdOverride, atingimento: calcAtingimento(ytdOverride.orcado, ytdOverride.realizado) };
  } else {
    const v = calcYtd(meses, mesFechado, def.tipoAgregacao);
    ytd = { ...v, atingimento: calcAtingimento(v.orcado, v.realizado) };
  }
  return { ...def, meses, ytd };
}

export async function montarMetricasGerais(deps: Deps): Promise<Linha[]> {
  const { db, orcado, realizadoDre, mrrInfoPorMes, pontualPorMes, dfcPorMes, mesCorrente, mesFechado } = deps;

  // ---- consultas próprias ----
  const vendasResult = await db.execute(sql`
    SELECT EXTRACT(MONTH FROM data_fechamento)::int AS mes,
           SUM(valor_recorrente::numeric) AS total
    FROM "Bitrix".crm_deal
    WHERE stage_name = 'Negócio Ganho' AND valor_recorrente > 0
      AND data_fechamento >= '2026-01-01' AND data_fechamento < '2027-01-01'
    GROUP BY 1 ORDER BY 1
  `);
  const vendasMrrPorMes: Record<number, number> = {};
  for (const row of vendasResult.rows as any[]) vendasMrrPorMes[Number(row.mes)] = parseFloat(row.total);

  const pessoasResult = await db.execute(sql`
    SELECT gs.mes,
           COUNT(p.*) AS total,
           COUNT(*) FILTER (WHERE TRIM(p.setor) IN ('Commerce', 'Tech Sites')) AS csv,
           COUNT(*) FILTER (WHERE TRIM(p.setor) = 'Growth Interno') AS cac,
           COUNT(*) FILTER (WHERE TRIM(p.setor) IN ('Backoffice', 'Sócios')) AS sgea
    FROM generate_series(1, 12) AS gs(mes)
    LEFT JOIN "Inhire".rh_pessoal p
      ON p.admissao IS NOT NULL
     AND p.admissao::date <= (make_date(2026, gs.mes, 1) + INTERVAL '1 month - 1 day')::date
     AND (p.demissao IS NULL OR p.demissao::date > (make_date(2026, gs.mes, 1) + INTERVAL '1 month - 1 day')::date)
    GROUP BY gs.mes ORDER BY gs.mes
  `);
  const pessoasPorMes: Record<number, { total: number; csv: number; cac: number; sgea: number }> = {};
  for (const row of pessoasResult.rows as any[]) {
    pessoasPorMes[Number(row.mes)] = {
      total: parseInt(row.total), csv: parseInt(row.csv), cac: parseInt(row.cac), sgea: parseInt(row.sgea),
    };
  }

  const churnResult = await db.execute(sql`
    SELECT EXTRACT(MONTH FROM data_solicitacao_encerramento)::int AS mes,
           SUM(valor_r) AS total
    FROM cortex_core.vw_cup_churn_ajustado
    WHERE data_solicitacao_encerramento >= '2026-01-01' AND data_solicitacao_encerramento < '2027-01-01'
      AND COALESCE(abonar_churn, '') != 'Sim'
      AND COALESCE(motivo_cancelamento, '') NOT IN ('Inadimplente 1º Mês', 'Não começou', 'Erro na Venda')
      AND valor_r > 0
    GROUP BY 1 ORDER BY 1
  `);
  const churnPorMes: Record<number, number> = {};
  for (const row of churnResult.rows as any[]) churnPorMes[Number(row.mes)] = parseFloat(row.total);

  const saldoResult = await db.execute(sql`SELECT COALESCE(SUM(balance::numeric), 0) AS saldo FROM "Conta Azul".caz_bancos`);
  const saldoAtual = parseFloat((saldoResult.rows[0] as any).saldo);

  // ---- séries auxiliares (a partir do DRE) ----
  const fat = serie(realizadoDre, "receita_total_faturavel");
  const inad = serie(realizadoDre, "inadimplencia");
  const mrr = serie(realizadoDre, "mrr_ativo");
  const geracao = serie(realizadoDre, "geracao_caixa");
  const impostosRec = serie(realizadoDre, "impostos_receita");
  const impostosDir = serie(realizadoDre, "impostos_diretos");
  const despesaTotal = somaSeries([
    impostosRec, serie(realizadoDre, "csv_salarios"), serie(realizadoDre, "csv_beneficio"),
    serie(realizadoDre, "csv_stack"), serie(realizadoDre, "cac"), serie(realizadoDre, "sga"),
    serie(realizadoDre, "bonus"), impostosDir, serie(realizadoDre, "capex"),
  ]);
  const receitaTotal = somaSeries([fat, inad.map((v) => (v === null ? null : -v))]);

  const mensal = (f: (mes: number) => number | null): (number | null)[] =>
    Array.from({ length: 12 }, (_, i) => (i + 1 <= mesCorrente ? f(i + 1) : null));

  const colaboradores = mensal((m) => pessoasPorMes[m]?.total ?? null);
  const clientes = mensal((m) => mrrInfoPorMes[m]?.clientes ?? null);
  const contratos = mensal((m) => mrrInfoPorMes[m]?.contratos ?? null);
  const vendasMrr = mensal((m) => vendasMrrPorMes[m] ?? 0);
  const vendasPontual = mensal((m) => pontualPorMes[m] ?? 0);
  const churn = mensal((m) => churnPorMes[m] ?? 0);
  // saldo fim do mês m = saldo atual − Σ fluxos dos meses m+1..mesCorrente
  const saldo = mensal((m) => {
    let s = saldoAtual;
    for (let k = m + 1; k <= mesCorrente; k++) s -= dfcPorMes[k] ?? 0;
    return s;
  });

  const receitaCabeca = Array.from({ length: 12 }, (_, i) => razao(receitaTotal[i], colaboradores[i]));
  const mrrCabeca = Array.from({ length: 12 }, (_, i) => razao(mrr[i], colaboradores[i]));
  const ticketCliente = Array.from({ length: 12 }, (_, i) => razao(mrr[i], clientes[i]));
  const ticketContrato = Array.from({ length: 12 }, (_, i) => razao(mrr[i], contratos[i]));
  const aliquota = Array.from({ length: 12 }, (_, i) =>
    razao(somaSeries([impostosRec, impostosDir])[i], fat[i])
  );
  const margemGeracao = Array.from({ length: 12 }, (_, i) => razao(geracao[i], fat[i]));

  // ---- YTDs derivados (razões sobre agregados, não média de %) ----
  const ytdFluxo = (s: (number | null)[]) =>
    mesFechado === 0 ? null : s.slice(0, mesFechado).reduce<number | null>((acc, v) => (v === null ? acc : (acc ?? 0) + v), null);
  const ytdEstoque = (s: (number | null)[]) => (mesFechado === 0 ? null : s[mesFechado - 1]);
  const ytdOrcFluxo = (m: string) => Array.from({ length: mesFechado }, (_, i) => orcado[m]?.[i + 1] ?? 0).reduce((a, b) => a + b, 0);
  const ytdOrcEstoque = (m: string) => orcado[m]?.[mesFechado] ?? 0;
  // faturável orçado do mês = soma dos 3 orçados de receita (a métrica derivada não existe no seed;
  // a planilha soma o MRR mensal no faturável, então a soma direta é o conceito correto)
  const orcFaturavelMes = (mes: number) =>
    (orcado["mrr_ativo"]?.[mes] ?? 0) + (orcado["receita_pontual"]?.[mes] ?? 0) + (orcado["outras_receitas"]?.[mes] ?? 0);
  const ytdOrcFaturavel = () =>
    Array.from({ length: mesFechado }, (_, i) => orcFaturavelMes(i + 1)).reduce((a, b) => a + b, 0);
  // YTD orçado de linha percentual = média ponderada pelo faturável orçado (exata, derivável do seed)
  const ytdOrcPctPonderada = (metrica: string) => {
    let num = 0;
    let den = 0;
    for (let mes = 1; mes <= mesFechado; mes++) {
      const fatMes = orcFaturavelMes(mes);
      num += (orcado[metrica]?.[mes] ?? 0) * fatMes;
      den += fatMes;
    }
    return den ? num / den : 0;
  };

  const linhas: Linha[] = [
    buildLinhaGeral({ metrica: "receita_total", titulo: "Receita Total", tipoAgregacao: "fluxo", direcao: "maior_melhor", unidade: "brl" }, orcado, receitaTotal, mesFechado),
    buildLinhaGeral({ metrica: "despesa_total", titulo: "Despesa Total", tipoAgregacao: "fluxo", direcao: "menor_melhor", unidade: "brl" }, orcado, despesaTotal, mesFechado),
    buildLinhaGeral({ metrica: "vendas_mrr", titulo: "Vendas MRR", tipoAgregacao: "fluxo", direcao: "maior_melhor", unidade: "brl" }, orcado, vendasMrr, mesFechado),
    buildLinhaGeral({ metrica: "vendas_pontual", titulo: "Vendas Pontual", tipoAgregacao: "fluxo", direcao: "maior_melhor", unidade: "brl" }, orcado, vendasPontual, mesFechado),
    buildLinhaGeral({ metrica: "colaboradores", titulo: "Número de Colaboradores", tipoAgregacao: "estoque", direcao: "neutro", unidade: "int" }, orcado, colaboradores, mesFechado),
    buildLinhaGeral({ metrica: "receita_cabeca", titulo: "Receita por Cabeça", tipoAgregacao: "fluxo", direcao: "maior_melhor", unidade: "brl" }, orcado, receitaCabeca, mesFechado,
      mesFechado === 0 ? undefined : { orcado: razao(ytdOrcFluxo("receita_total"), ytdOrcEstoque("colaboradores")) ?? 0, realizado: razao(ytdFluxo(receitaTotal), ytdEstoque(colaboradores)) }),
    buildLinhaGeral({ metrica: "mrr_cabeca", titulo: "MRR por Cabeça", tipoAgregacao: "fluxo", direcao: "maior_melhor", unidade: "brl" }, orcado, mrrCabeca, mesFechado,
      mesFechado === 0 ? undefined : { orcado: razao(ytdOrcEstoque("mrr_ativo"), ytdOrcEstoque("colaboradores")) ?? 0, realizado: razao(ytdEstoque(mrr), ytdEstoque(colaboradores)) }),
    buildLinhaGeral({ metrica: "clientes", titulo: "Número de Clientes", tipoAgregacao: "estoque", direcao: "maior_melhor", unidade: "int" }, orcado, clientes, mesFechado),
    buildLinhaGeral({ metrica: "contratos", titulo: "Número de Contratos", tipoAgregacao: "estoque", direcao: "maior_melhor", unidade: "int" }, orcado, contratos, mesFechado),
    buildLinhaGeral({ metrica: "ticket_cliente", titulo: "Ticket Médio por Cliente", tipoAgregacao: "fluxo", direcao: "maior_melhor", unidade: "brl" }, orcado, ticketCliente, mesFechado,
      mesFechado === 0 ? undefined : { orcado: razao(ytdOrcEstoque("mrr_ativo"), ytdOrcEstoque("clientes")) ?? 0, realizado: razao(ytdEstoque(mrr), ytdEstoque(clientes)) }),
    buildLinhaGeral({ metrica: "ticket_contrato", titulo: "Ticket Médio por Contrato", tipoAgregacao: "fluxo", direcao: "maior_melhor", unidade: "brl" }, orcado, ticketContrato, mesFechado,
      mesFechado === 0 ? undefined : { orcado: razao(ytdOrcEstoque("mrr_ativo"), ytdOrcEstoque("contratos")) ?? 0, realizado: razao(ytdEstoque(mrr), ytdEstoque(contratos)) }),
    buildLinhaGeral({ metrica: "churn_mes", titulo: "Churn do Mês", tipoAgregacao: "fluxo", direcao: "menor_melhor", unidade: "brl" }, orcado, churn, mesFechado),
    buildLinhaGeral({ metrica: "aliquota_efetiva", titulo: "Alíquota de Imposto Efetiva", tipoAgregacao: "fluxo", direcao: "menor_melhor", unidade: "pct" }, orcado, aliquota, mesFechado,
      mesFechado === 0 ? undefined : { orcado: razao(ytdOrcFluxo("impostos_receita") + ytdOrcFluxo("impostos_diretos"), ytdOrcFaturavel()) ?? 0, realizado: razao((ytdFluxo(impostosRec) ?? 0) + (ytdFluxo(impostosDir) ?? 0), ytdFluxo(fat)) }),
    buildLinhaGeral({ metrica: "margem_geracao", titulo: "Margem de Geração", tipoAgregacao: "fluxo", direcao: "maior_melhor", unidade: "pct" }, orcado, margemGeracao, mesFechado,
      mesFechado === 0 ? undefined : { orcado: ytdOrcPctPonderada("margem_geracao"), realizado: razao(ytdFluxo(geracao), ytdFluxo(fat)) }),
    buildLinhaGeral({ metrica: "saldo_caixa", titulo: "Saldo de Caixa", tipoAgregacao: "estoque", direcao: "maior_melhor", unidade: "brl", nota: NOTA_SALDO }, orcado, saldo, mesFechado),
    buildLinhaGeral({ metrica: "pessoas_csv", titulo: "Pessoas em CSV", tipoAgregacao: "estoque", direcao: "neutro", unidade: "int", nota: NOTA_PESSOAS }, orcado, mensal((m) => pessoasPorMes[m]?.csv ?? null), mesFechado),
    buildLinhaGeral({ metrica: "pessoas_cac", titulo: "Pessoas em CAC", tipoAgregacao: "estoque", direcao: "neutro", unidade: "int", nota: NOTA_PESSOAS }, orcado, mensal((m) => pessoasPorMes[m]?.cac ?? null), mesFechado),
    buildLinhaGeral({ metrica: "pessoas_sgea", titulo: "Pessoas em SGEA", tipoAgregacao: "estoque", direcao: "neutro", unidade: "int", nota: NOTA_PESSOAS }, orcado, mensal((m) => pessoasPorMes[m]?.sgea ?? null), mesFechado),
  ];
  return linhas;
}

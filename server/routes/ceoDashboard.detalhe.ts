import type { Express } from "express";
import { sql } from "drizzle-orm";
import { montarDetalheBp } from "./bp2026.detalhe";
import { computarBpReceitas } from "./bp2026";
import { storage } from "../storage";
import { canAccessCeo, parseMesNum, receitaCabecaCaixaFromBp, receitaRecebidaFromBp, type BpLinha } from "./ceoDashboard.helpers";
import {
  achatarComponente, mapDetalheBpGrupos, bancosToGrupo, inadClientesToGrupos,
  enpsRespostasToGrupos, grupoMargemBruta, receitaCabecaGrupos, formatBRL, LIMITE_ITENS,
  recebidoCategoriasToGrupo, pagoCategoriasToGrupo, serieEvolucao, KPI_COMPONENTES,
  ltvAuditoriaToGrupos, ultimoDiaAnterior,
  type CeoGrupo, type CeoDetalheResponse, type PontoEvolucao, type LtvAuditoriaRow,
} from "./ceoDashboard.detalhe.helpers";
import { SERVICOS_BITRIX, parseServicosVendidos } from "../okr2026/servicosBitrix";
import { carregarMovimentoQueries, montarMovimentoReceita, type MovimentoReceita } from "./ceoDashboard.movimentoReceita";
import { getCrosssellDealsDetail } from "../okr2026/metricsAdapter";

// Sub-linhas comerciais que compõem o CAC total (mesmos títulos da aba CAC do BP) —
// usadas para expandir a caixa "CAC total" no drill de CAC por cliente/contrato.
const SUB_CAC_METRICAS = [
  "cac_pre_vendas", "cac_vendas", "cac_gerencia", "cac_comissoes", "cac_growth",
  "cac_ads", "cac_eventos", "cac_brindes", "cac_viagens", "cac_outras_sub",
];

// Fonte da série mensal (realizado vs meta) por KPI — só os que têm evolução no BP.
// receita e receita_cabeca usam as linhas sintéticas de caixa (montadas à parte).
const EVOLUCAO_FONTE: Record<string, { arr: "linhas" | "metricasGerais" | "cacDetalhe"; metrica: string }> = {
  custos: { arr: "metricasGerais", metrica: "despesa_total" },
  lucro: { arr: "linhas", metrica: "ebitda" },
  geracao_caixa: { arr: "linhas", metrica: "dfc_real" },
  caixa: { arr: "metricasGerais", metrica: "saldo_caixa" },
  cac: { arr: "linhas", metrica: "cac" },
  cac_por_cliente: { arr: "cacDetalhe", metrica: "cac_por_cliente" },
  cac_por_contrato: { arr: "cacDetalhe", metrica: "cac_por_contrato" },
  headcount: { arr: "metricasGerais", metrica: "colaboradores" },
};

// Receita recebida por categoria no mês (entradas de RECEITA quitadas por data_quitacao).
// Soma exatamente o faturamentoCaixaPorMes do mês → reconcilia com o header do card.
async function recebidoPorCategoria(db: any, mesNum: number): Promise<Array<{ categoria: string; valor: number }>> {
  const ini = `2026-${String(mesNum).padStart(2, "0")}-01`;
  const fim = mesNum >= 12 ? "2027-01-01" : `2026-${String(mesNum + 1).padStart(2, "0")}-01`;
  const r: any = await db.execute(sql`
    SELECT COALESCE(categoria_nome, '(sem categoria)') AS categoria,
           SUM(COALESCE(valor_pago::numeric, 0)) AS valor
    FROM "Conta Azul".caz_parcelas
    WHERE tipo_evento = 'RECEITA' AND status = 'QUITADO'
      AND data_quitacao >= ${ini}::date AND data_quitacao < ${fim}::date
    GROUP BY 1 ORDER BY SUM(COALESCE(valor_pago::numeric, 0)) DESC`);
  return (r.rows ?? []).map((x: any) => ({ categoria: String(x.categoria), valor: Number(x.valor) || 0 }));
}

// Saídas de caixa por categoria no mês (parcelas de DESPESA quitadas por data_quitacao).
// Espelho da recebidoPorCategoria — juntas reconstroem o fluxo da DFC (dfc_real do BP).
async function pagoPorCategoria(db: any, mesNum: number): Promise<Array<{ categoria: string; valor: number }>> {
  const ini = `2026-${String(mesNum).padStart(2, "0")}-01`;
  const fim = mesNum >= 12 ? "2027-01-01" : `2026-${String(mesNum + 1).padStart(2, "0")}-01`;
  const r: any = await db.execute(sql`
    SELECT COALESCE(categoria_nome, '(sem categoria)') AS categoria,
           SUM(COALESCE(valor_pago::numeric, 0)) AS valor
    FROM "Conta Azul".caz_parcelas
    WHERE tipo_evento = 'DESPESA' AND status = 'QUITADO'
      AND data_quitacao >= ${ini}::date AND data_quitacao < ${fim}::date
    GROUP BY 1 ORDER BY SUM(COALESCE(valor_pago::numeric, 0)) DESC`);
  return (r.rows ?? []).map((x: any) => ({ categoria: String(x.categoria), valor: Number(x.valor) || 0 }));
}

// Deals ganhos no Bitrix no mês — mesmo filtro de ganhosPorMes/serviços do BP:
// stage ganho + (MRR ou pontual > 0), por data_fechamento. Traz servicos_vendidos
// p/ expandir a caixa do denominador (deals para "cliente", serviços para "contrato").
async function dealsGanhosDoMes(
  db: any, mesNum: number
): Promise<Array<{ title: string; closer: string; data: string | null; ids: number[]; montante: number }>> {
  const r: any = await db.execute(sql`
    SELECT COALESCE(d.title, '(sem título)') AS title,
           COALESCE(NULLIF(TRIM(c.nome), ''), '') AS closer,
           d.data_fechamento::date::text AS data,
           d.servicos_vendidos,
           COALESCE(d.valor_recorrente::numeric, 0) AS vr,
           COALESCE(d.valor_pontual::numeric, 0) AS vp
    FROM "Bitrix".crm_deal d
    LEFT JOIN "Bitrix".crm_closers c
      ON CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = c.id
    WHERE d.stage_name = 'Negócio Ganho'
      AND EXTRACT(YEAR FROM d.data_fechamento) = 2026
      AND EXTRACT(MONTH FROM d.data_fechamento) = ${mesNum}
      AND (COALESCE(d.valor_recorrente::numeric, 0) > 0 OR COALESCE(d.valor_pontual::numeric, 0) > 0)
    ORDER BY (COALESCE(d.valor_recorrente::numeric, 0) + COALESCE(d.valor_pontual::numeric, 0)) DESC`);
  return (r.rows ?? []).map((x: any) => ({
    title: String(x.title),
    closer: String(x.closer || ""),
    data: x.data ? String(x.data) : null,
    ids: parseServicosVendidos(x.servicos_vendidos),
    montante: (Number(x.vr) || 0) + (Number(x.vp) || 0),
  }));
}

// Deals ganhos do mês com valor recorrente OU pontual (conforme campo), p/ os drills de venda.
async function dealsVendaDoMes(
  db: any, mesNum: number, campo: "valor_recorrente" | "valor_pontual"
): Promise<Array<{ nome: string; detalhe: string; data: string | null; valor: number }>> {
  const col = campo === "valor_recorrente" ? sql`d.valor_recorrente` : sql`d.valor_pontual`;
  const r: any = await db.execute(sql`
    SELECT COALESCE(NULLIF(d.company_name,''), d.title, '(sem nome)') AS nome,
           COALESCE(NULLIF(TRIM(c.nome), ''), d.assigned_by_name, '') AS closer,
           d.data_fechamento::date::text AS data,
           COALESCE(${col}::numeric, 0) AS valor
    FROM "Bitrix".crm_deal d
    LEFT JOIN "Bitrix".crm_closers c
      ON CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = c.id
    WHERE d.stage_name='Negócio Ganho'
      AND EXTRACT(YEAR FROM d.data_fechamento)=2026 AND EXTRACT(MONTH FROM d.data_fechamento)=${mesNum}
      AND COALESCE(${col}::numeric,0) > 0
    ORDER BY COALESCE(${col}::numeric,0) DESC`);
  return (r.rows ?? []).map((x: any) => ({
    nome: String(x.nome), detalhe: x.closer ? `closer ${x.closer}` : "",
    data: x.data ? String(x.data) : null, valor: Number(x.valor) || 0,
  }));
}

// Contratos recorrentes que deram churn no mês (mesma régua de churn_mes: vw_cup_churn_ajustado).
async function churnMrrDoMes(db: any, mesNum: number): Promise<Array<{ nome: string; detalhe: string; data: string | null; valor: number }>> {
  const r: any = await db.execute(sql`
    SELECT COALESCE(NULLIF(nome,''), '(sem nome)') AS nome,
           COALESCE(responsavel_geral, '') AS resp,
           data_solicitacao_encerramento::date::text AS data,
           valor_r::numeric AS valor
    FROM cortex_core.vw_cup_churn_ajustado
    WHERE valor_r > 0 AND data_solicitacao_encerramento IS NOT NULL
      AND EXTRACT(YEAR FROM data_solicitacao_encerramento)=2026
      AND EXTRACT(MONTH FROM data_solicitacao_encerramento)=${mesNum}
    ORDER BY valor_r::numeric DESC`);
  return (r.rows ?? []).map((x: any) => ({
    nome: String(x.nome), detalhe: x.resp ? String(x.resp) : "",
    data: x.data ? String(x.data) : null, valor: Number(x.valor) || 0,
  }));
}

// Contratos pontuais cancelados no mês por data de cancelamento (régua de pontual_churn).
async function churnPontualDoMes(db: any, mesNum: number): Promise<Array<{ nome: string; detalhe: string; data: string | null; valor: number }>> {
  const r: any = await db.execute(sql`
    SELECT COALESCE(NULLIF(cl.nome,''), '(sem nome)') AS nome,
           COALESCE(co.status,'') AS status,
           co.data_solicitacao_encerramento::date::text AS data,
           co.valorp::numeric AS valor
    FROM "Clickup".cup_contratos co
    LEFT JOIN "Clickup".cup_clientes cl ON co.id_task = cl.task_id
    WHERE co.valorp::numeric > 0
      AND LOWER(TRIM(co.status)) IN ('cancelado/inativo','em cancelamento','não usar')
      AND EXTRACT(YEAR FROM co.data_solicitacao_encerramento)=2026
      AND EXTRACT(MONTH FROM co.data_solicitacao_encerramento)=${mesNum}
    ORDER BY co.valorp::numeric DESC`);
  return (r.rows ?? []).map((x: any) => ({
    nome: String(x.nome), detalhe: x.status ? String(x.status) : "",
    data: x.data ? String(x.data) : null, valor: Number(x.valor) || 0,
  }));
}

// Converte itens simples num grupo do drawer (total = soma, cap LIMITE_ITENS).
function itensParaGrupo(titulo: string, itens: Array<{ nome: string; detalhe: string; data: string | null; valor: number }>, totalAutoritativo: number): CeoGrupo {
  const cap = itens.slice(0, LIMITE_ITENS);
  const omit = itens.slice(LIMITE_ITENS);
  return {
    titulo, formato: "brl", total: totalAutoritativo, aberto: true,
    itens: cap.map((it) => ({ nome: it.nome, detalhe: it.detalhe, data: it.data, valor: it.valor })),
    itensOmitidos: omit.length ? { qtd: omit.length, valor: omit.reduce((s, i) => s + i.valor, 0) } : undefined,
  };
}

const TITULOS: Record<string, string> = {
  receita: "Receita", custos: "Custos & Despesas", lucro: "Lucro (EBITDA)", geracao_caixa: "Geração de Caixa",
  caixa: "Saldo de Caixa", inadimplencia: "Inadimplência Total", cac: "CAC",
  cac_por_cliente: "CAC por cliente", cac_por_contrato: "CAC por contrato",
  ltv_fat: "LTV FAT", ltv_dfc: "LTV DFC", headcount: "Headcount", enps: "E-NPS", receita_cabeca: "Receita / Cabeça",
  venda_mrr: "Venda MRR", churn_mrr: "Churn MRR", cross_mrr: "Venda de Cross-sell/Upsell MRR", nrr: "NRR",
  venda_pontual: "Venda Pontual", churn_pontual: "Churn Pontual", cross_pontual: "Venda de Cross-sell/Upsell Pontual", nrr_pontual: "NRR Pontual",
};

function linhaValor(bp: any, arr: "linhas" | "metricasGerais", metrica: string, mesNum: number): { orcado: number | null; realizado: number | null } {
  const linha = (bp[arr] ?? []).find((l: any) => l.metrica === metrica);
  const m = linha?.meses?.find((x: any) => x.mes === mesNum);
  return { orcado: m?.orcado ?? null, realizado: m?.realizado ?? null };
}

async function componentesGrupos(db: any, kpi: string, mesNum: number): Promise<CeoGrupo[]> {
  const comps = KPI_COMPONENTES[kpi];
  const grupos: CeoGrupo[] = [];
  for (const c of comps) {
    const det = await montarDetalheBp(db, { metrica: c.slug, mes: mesNum });
    grupos.push(achatarComponente(det, { titulo: c.titulo, sinal: c.sinal, formato: "brl" }));
  }
  return grupos;
}

export async function buildCeoDetalhe(db: any, kpi: string, mes?: string): Promise<CeoDetalheResponse> {
  const bp: any = await computarBpReceitas(db);
  const mesNum = parseMesNum(mes, bp.mesCorrente);
  const unidade: "brl" | "int" = kpi === "headcount" ? "int" : "brl";
  const base = { kpi, titulo: TITULOS[kpi] ?? kpi, mes: mesNum, unidade, orcado: null as number | null, realizado: null as number | null, atingimentoPct: null as number | null };
  let grupos: CeoGrupo[] = [];
  let nota: string | undefined;
  let media: number | null | undefined; // só a auditoria de LTV preenche (mediana × média)
  let somaLtv: number | null | undefined; // numerador da média (auditoria de LTV)
  let nClientes: number | null | undefined; // população da auditoria de LTV
  let linhaMovParaEvolucao: BpLinha | undefined; // linha do movimento usada no branch MOV_KEYS, p/ reusar na série de evolução

  const MOV_KEYS = ["venda_mrr","churn_mrr","cross_mrr","nrr","venda_pontual","churn_pontual","cross_pontual","nrr_pontual"];

  if (kpi === "receita") {
    // Regime de caixa: header = recebido (DFC); breakdown por categoria de recebimento.
    const recebido = bp.receitaRecebidaCaixaPorMes?.[mesNum] ?? 0;
    grupos = [recebidoCategoriasToGrupo(await recebidoPorCategoria(db, mesNum))];
    base.orcado = linhaValor(bp, "metricasGerais", "receita_total", mesNum).orcado;
    base.realizado = recebido;
    nota = "Receita efetivamente recebida no mês (entradas de RECEITA quitadas · base de caixa da DFC). Meta = plano de receita do BP.";
  } else if (kpi === "custos") {
    grupos = await componentesGrupos(db, "custos", mesNum);
    const v = linhaValor(bp, "metricasGerais", "despesa_total", mesNum);
    base.orcado = v.orcado; base.realizado = v.realizado;
  } else if (kpi === "cac") {
    const det = await montarDetalheBp(db, { metrica: "cac", mes: mesNum });
    grupos = mapDetalheBpGrupos(det, { formato: "brl", sinal: "-" });
    base.orcado = det.orcado; base.realizado = det.realizado;
  } else if (kpi === "cac_por_cliente" || kpi === "cac_por_contrato") {
    // Razão de eficiência: CAC total do mês ÷ denominador (deals ganhos | serviços vendidos).
    // DUAS caixas expansíveis: (1) CAC total → sub-linhas comerciais; (2) denominador → itens do Bitrix.
    const det = await montarDetalheBp(db, { metrica: "cac", mes: mesNum });
    const cacTotal = det.realizado ?? 0;
    // denominador autoritativo = o mesmo do BP (reconcilia com a célula clicada).
    const den = kpi === "cac_por_cliente"
      ? (bp.cacDenominadores?.deals?.[mesNum] ?? 0)
      : (bp.cacDenominadores?.servicos?.[mesNum] ?? 0);

    // Caixa 1: CAC total → sub-linhas (Growth, ADs, Vendas…); soma = CAC total.
    const cacItens = (bp.cacDetalhe ?? [])
      .filter((l: any) => SUB_CAC_METRICAS.includes(l.metrica))
      .map((l: any) => ({
        nome: l.titulo, detalhe: "", data: null as string | null,
        valor: l.meses?.find((m: any) => m.mes === mesNum)?.realizado ?? 0,
      }))
      .filter((it: any) => it.valor !== 0)
      .sort((a: any, b: any) => b.valor - a.valor);
    const grupoCac: CeoGrupo = {
      titulo: "CAC total do mês (regime de caixa)", total: cacTotal, formato: "brl",
      itens: cacItens, aberto: true,
    };

    // Caixa 2: denominador → deals ganhos (cliente) ou serviços vendidos (contrato).
    const deals = await dealsGanhosDoMes(db, mesNum);
    let denItens: Array<{ nome: string; detalhe: string; data: string | null; valor: number }>;
    let tituloDen: string;
    if (kpi === "cac_por_cliente") {
      tituloDen = "Deals ganhos (Bitrix)";
      denItens = deals.map((d) => ({
        nome: d.title,
        detalhe: [d.closer ? `closer ${d.closer}` : "", d.montante > 0 ? formatBRL(d.montante) : ""].filter(Boolean).join(" · "),
        data: d.data, valor: 0,
      }));
    } else {
      // 1 item por serviço vendido; deal sem serviço mapeado conta 1 (piso, régua do BP) → soma = den.
      tituloDen = "Serviços vendidos (Bitrix)";
      denItens = [];
      for (const d of deals) {
        const contexto = d.closer ? `${d.title} · closer ${d.closer}` : d.title;
        const mapeados = d.ids.filter((id) => SERVICOS_BITRIX[id]);
        if (mapeados.length) {
          for (const id of mapeados) denItens.push({ nome: SERVICOS_BITRIX[id].nome, detalhe: contexto, data: d.data, valor: 0 });
        } else {
          denItens.push({ nome: "(serviço não mapeado)", detalhe: contexto, data: d.data, valor: 0 });
        }
      }
    }
    const capped = denItens.slice(0, LIMITE_ITENS);
    const omit = Math.max(0, den - capped.length); // total exibido = den (reconcilia com a célula)
    const grupoDen: CeoGrupo = {
      titulo: tituloDen, total: den, formato: "num", itens: capped,
      itensOmitidos: omit > 0 ? { qtd: omit, valor: 0 } : undefined, aberto: false,
    };

    grupos = [grupoCac, grupoDen];
    const razao = den ? cacTotal / den : 0;
    nota = `CAC total ÷ ${tituloDen.charAt(0).toLowerCase()}${tituloDen.slice(1)} = ${formatBRL(cacTotal)} ÷ ${den} = ${formatBRL(razao)}`;
    // Header (orçado/realizado) = a própria razão do BP → reconcilia com a célula clicada.
    const linha = (bp.cacDetalhe ?? []).find((l: any) => l.metrica === kpi);
    const m = linha?.meses?.find((x: any) => x.mes === mesNum);
    base.orcado = m?.orcado ?? null; base.realizado = m?.realizado ?? null;
  } else if (kpi === "headcount") {
    const det = await montarDetalheBp(db, { metrica: "colaboradores", mes: mesNum });
    grupos = mapDetalheBpGrupos(det, { formato: "num" });
    const v = linhaValor(bp, "metricasGerais", "colaboradores", mesNum);
    base.orcado = v.orcado; base.realizado = v.realizado;
  } else if (kpi === "lucro") {
    const mb = linhaValor(bp, "linhas", "margem_bruta", mesNum);
    grupos.push(grupoMargemBruta(mb.realizado ?? 0));
    for (const slug of ["cac", "sga", "bonus"]) {
      const det = await montarDetalheBp(db, { metrica: slug, mes: mesNum });
      grupos.push(achatarComponente(det, { sinal: "-", formato: "brl" }));
    }
    const eb = linhaValor(bp, "linhas", "ebitda", mesNum);
    base.orcado = eb.orcado; base.realizado = eb.realizado;
    nota = "EBITDA = Margem Bruta − CAC − SG&A − Bônus (competência, régua do BP).";
  } else if (kpi === "geracao_caixa") {
    // DFC do mês: entradas − saídas quitadas (caixa nos dois lados) — mesma linha dfc_real do BP.
    grupos = [
      { ...recebidoCategoriasToGrupo(await recebidoPorCategoria(db, mesNum)), sinal: "+" as const },
      { ...pagoCategoriasToGrupo(await pagoPorCategoria(db, mesNum)), sinal: "-" as const },
    ];
    const v = linhaValor(bp, "linhas", "dfc_real", mesNum);
    base.orcado = v.orcado; base.realizado = v.realizado;
    nota = "Geração de Caixa (DFC) = entradas − saídas quitadas no mês (regime de caixa nos dois lados). Meta = geração de caixa orçada no BP. ≠ Receita − Custos da tabela: lá os custos são competência (DRE).";
  } else if (kpi === "receita_cabeca") {
    // Numerador em regime de caixa (receita recebida / DFC), não o faturável (competência).
    const recebido = bp.receitaRecebidaCaixaPorMes?.[mesNum] ?? 0;
    const head = linhaValor(bp, "metricasGerais", "colaboradores", mesNum);
    const rc = receitaCabecaGrupos(recebido, head.realizado ?? 0);
    grupos = rc.grupos; nota = rc.nota;
    // Cabeçalho vem da MESMA linha sintética usada no card, p/ reconciliar orçado/realizado.
    const linha = receitaCabecaCaixaFromBp(bp);
    const m = linha.meses.find((x) => x.mes === mesNum);
    base.orcado = m?.orcado ?? null; base.realizado = m?.realizado ?? null;
  } else if (kpi === "caixa") {
    const rows: any = await db.execute(sql`
      SELECT nmbanco, empresa, balance FROM "Conta Azul".caz_bancos ORDER BY balance DESC NULLS LAST`);
    grupos = [bancosToGrupo(rows.rows ?? [])];
    const v = linhaValor(bp, "metricasGerais", "saldo_caixa", mesNum);
    base.orcado = v.orcado; base.realizado = v.realizado;
    nota = "Itens = saldos atuais das contas (foto de hoje); o total do cabeçalho é o Saldo de Caixa do BP.";
  } else if (kpi === "inadimplencia") {
    const res = await storage.getInadimplenciaClientes(undefined, undefined, "valor", 200);
    grupos = inadClientesToGrupos(res.clientes ?? []);
    const resumo = await storage.getInadimplenciaResumo();
    base.realizado = resumo.totalInadimplente ?? null;
  } else if (kpi === "ltv_fat" || kpi === "ltv_dfc") {
    // AUDITORIA do mês clicado: mesma população e régua da célula da matriz
    // (spec: docs/superpowers/specs/2026-07-09-ltv-auditoria-celulas-design.md).
    // MATERIALIZED obrigatório (mesmo racional da query da matriz).
    const rows: any = await db.execute(sql`
      WITH alvo AS (SELECT make_date(2026, ${mesNum}, 1) AS m),
      snap_ref AS MATERIALIZED (
        SELECT COALESCE(
          (SELECT data_snapshot FROM "Clickup".cup_data_hist, alvo WHERE data_snapshot = alvo.m LIMIT 1),
          (SELECT MIN(data_snapshot) FROM "Clickup".cup_data_hist, alvo WHERE date_trunc('month', data_snapshot) = alvo.m)
        ) AS snap
      ),
      ativos AS MATERIALIZED (
        SELECT h.id_task, MAX(sr.snap) AS snap,
          COALESCE(SUM(h.valorr) FILTER (WHERE h.status IN ('ativo','onboarding','triagem') AND h.valorr > 0), 0) AS valorr_snap,
          COUNT(*) FILTER (WHERE h.status IN ('ativo','onboarding','triagem') AND h.valorr > 0) AS n_rec_snap
        FROM snap_ref sr
        JOIN "Clickup".cup_data_hist h ON h.data_snapshot = sr.snap
        WHERE sr.snap IS NOT NULL
        GROUP BY h.id_task
        HAVING BOOL_OR(h.status IN ('ativo','onboarding','triagem') AND h.valorr > 0)
      ),
      click_norm AS MATERIALIZED (
        SELECT cl.task_id, regexp_replace(cl.cnpj::text, '\\D', '', 'g') AS cnpj_norm
        FROM "Clickup".cup_clientes cl
        WHERE LENGTH(regexp_replace(cl.cnpj::text, '\\D', '', 'g')) IN (11, 14)
      ),
      caz_norm AS MATERIALIZED (
        SELECT c.ids, regexp_replace(c.cnpj::text, '\\D', '', 'g') AS cnpj_norm
        FROM "Conta Azul".caz_clientes c
        WHERE LENGTH(regexp_replace(c.cnpj::text, '\\D', '', 'g')) IN (11, 14)
      ),
      caz_map AS MATERIALIZED (
        SELECT DISTINCT k.task_id, z.ids FROM click_norm k JOIN caz_norm z USING (cnpj_norm)
      ),
      match_task AS MATERIALIZED (SELECT DISTINCT task_id FROM caz_map),
      rec_stats AS MATERIALIZED (
        SELECT a.id_task,
          COALESCE(SUM(v.valorr * GREATEST((LEAST(COALESCE(v.data_fim, a.snap), a.snap) - v.data_inicio)::numeric, 0) / 30.44), 0) AS rec_full,
          COALESCE(SUM(v.valorr * GREATEST((LEAST(COALESCE(v.data_fim, DATE '2025-09-30'), DATE '2025-09-30') - v.data_inicio)::numeric, 0) / 30.44), 0) AS rec_pre,
          MIN(v.data_inicio) AS inicio_rec
        FROM ativos a
        LEFT JOIN cortex_core.vw_lt_contratos v
          ON v.id_task = a.id_task AND v.tipo_receita = 'recorrente' AND v.data_inicio IS NOT NULL
        GROUP BY a.id_task
      ),
      pont_stats AS MATERIALIZED (
        SELECT a.id_task,
          COALESCE(SUM(co.valorp) FILTER (WHERE COALESCE(co.data_entrega, co.data_criado) < a.snap), 0) AS pont_full,
          COALESCE(SUM(co.valorp) FILTER (WHERE COALESCE(co.data_entrega, co.data_criado) < DATE '2025-10-01'), 0) AS pont_pre
        FROM ativos a
        JOIN "Clickup".cup_contratos co
          ON co.id_task = a.id_task AND co.valorp > 0 AND (co.valorr IS NULL OR co.valorr = 0) AND co.status = 'entregue'
        GROUP BY a.id_task
      ),
      pago_stats AS MATERIALIZED (
        SELECT cm.task_id, SUM(pa.valor_pago) AS pago, COUNT(*) AS n_parcelas
        FROM caz_map cm
        JOIN "Conta Azul".caz_parcelas pa ON pa.id_cliente::text = cm.ids
        CROSS JOIN alvo
        WHERE pa.tipo_evento = 'RECEITA'
          AND pa.data_quitacao >= DATE '2025-10-01'
          AND pa.data_quitacao::date < alvo.m
        GROUP BY cm.task_id
      )
      SELECT a.id_task,
        COALESCE((SELECT MIN(c2.nome) FROM "Clickup".cup_clientes c2 WHERE c2.task_id = a.id_task), a.id_task) AS nome,
        mt.task_id IS NOT NULL AS tem_match,
        a.valorr_snap, a.n_rec_snap, r.inicio_rec,
        ROUND(r.rec_full, 2) AS rec_full,
        ROUND(r.rec_pre, 2) AS rec_pre,
        COALESCE(p.pont_full, 0) AS pont_full,
        COALESCE(p.pont_pre, 0) AS pont_pre,
        COALESCE(pg.pago, 0) AS pago,
        COALESCE(pg.n_parcelas, 0) AS n_parcelas,
        (r.rec_full + COALESCE(p.pont_full, 0)) AS ltv_fat,
        (CASE WHEN mt.task_id IS NOT NULL
          THEN r.rec_pre + COALESCE(p.pont_pre, 0) + COALESCE(pg.pago, 0)
          ELSE r.rec_full + COALESCE(p.pont_full, 0) END) AS ltv_dfc
      FROM ativos a
      LEFT JOIN match_task mt ON mt.task_id = a.id_task
      LEFT JOIN rec_stats r ON r.id_task = a.id_task
      LEFT JOIN pont_stats p ON p.id_task = a.id_task
      LEFT JOIN pago_stats pg ON pg.task_id = a.id_task`);
    const parsed: LtvAuditoriaRow[] = (rows.rows ?? []).map((x: any) => ({
      nome: String(x.nome ?? "—"),
      tem_match: !!x.tem_match,
      valorr_snap: Number(x.valorr_snap) || 0,
      n_rec_snap: Number(x.n_rec_snap) || 0,
      // node-postgres devolve DATE como Date JS; normalizar para "YYYY-MM-DD".
      inicio_rec: x.inicio_rec instanceof Date
        ? `${x.inicio_rec.getFullYear()}-${String(x.inicio_rec.getMonth() + 1).padStart(2, "0")}-${String(x.inicio_rec.getDate()).padStart(2, "0")}`
        : x.inicio_rec ? String(x.inicio_rec).slice(0, 10) : null,
      rec_full: Number(x.rec_full) || 0,
      rec_pre: Number(x.rec_pre) || 0,
      pont_full: Number(x.pont_full) || 0,
      pont_pre: Number(x.pont_pre) || 0,
      pago: Number(x.pago) || 0,
      n_parcelas: Number(x.n_parcelas) || 0,
      ltv_fat: Number(x.ltv_fat) || 0,
      ltv_dfc: Number(x.ltv_dfc) || 0,
    }));
    const aud = ltvAuditoriaToGrupos(parsed, kpi as "ltv_fat" | "ltv_dfc", mesNum);
    grupos = aud.grupos;
    base.realizado = aud.mediana;
    media = aud.media;
    somaLtv = aud.soma;
    nClientes = parsed.length;
    const regua = kpi === "ltv_fat"
      ? "Régua FAT (faturável): Valor R × meses de vida até o snapshot + pontual entregue"
      : `Régua DFC (caixa): faturável teórico até 30/set/25 + pago real no Conta Azul via CNPJ (parcelas RECEITA quitadas até ${ultimoDiaAnterior(mesNum)})${aud.nSemMatch > 0 ? `; ${aud.nSemMatch} cliente${aud.nSemMatch === 1 ? "" : "s"} sem match CNPJ usa${aud.nSemMatch === 1 ? "" : "m"} a régua faturável` : ""}`;
    nota = `Célula = MEDIANA de ${parsed.length} clientes ativos no 1º snapshot de ${String(mesNum).padStart(2, "0")}/2026 (N par = média dos 2 centrais). ${regua}.`;
  } else if (kpi === "enps") {
    const respostas: any = await storage.getRhNpsRespostas();
    grupos = enpsRespostasToGrupos(respostas ?? []);
    nota = "E-NPS (empresa) — todas as respostas disponíveis.";
  } else if (MOV_KEYS.includes(kpi)) {
    const findLinha = (arr: any[], metrica: string) => (arr ?? []).find((l: any) => l.metrica === metrica);
    const queries = await carregarMovimentoQueries(db);
    const mov: MovimentoReceita = montarMovimentoReceita({
      vendasMrr: findLinha(bp.metricasGerais, "vendas_mrr"),
      churnMes: findLinha(bp.metricasGerais, "churn_mes"),
      vendasPontual: findLinha(bp.metricasGerais, "vendas_pontual"),
      pontualChurn: findLinha(bp.pontual, "pontual_churn"),
      pontualEstoqueIni: findLinha(bp.pontual, "pontual_estoque_ini"),
      queries, mesNum,
    });
    const linhaKpi: Record<string, BpLinha> = {
      venda_mrr: mov.linhas.vendaMrr, churn_mrr: mov.linhas.churnMrr, cross_mrr: mov.linhas.crossMrr, nrr: mov.linhas.nrr,
      venda_pontual: mov.linhas.vendaPontual, churn_pontual: mov.linhas.churnPontual, cross_pontual: mov.linhas.crossPontual, nrr_pontual: mov.linhas.nrrPontual,
    };
    const linha = linhaKpi[kpi];
    linhaMovParaEvolucao = linha;
    const mesData = linha.meses.find((m) => m.mes === mesNum);
    base.realizado = mesData?.realizado ?? null;
    base.orcado = mesData?.orcado || null;
    const ehPct = kpi === "nrr" || kpi === "nrr_pontual";
    // unidade do detalhe (afeta o header/gráfico); o cast é seguro pois estendemos o tipo.
    (base as any).unidade = ehPct ? "pct" : "brl";

    const ini = `2026-${String(mesNum).padStart(2, "0")}-01`;
    const fim = mesNum >= 12 ? "2026-12-31" : `2026-${String(mesNum).padStart(2, "0")}-${new Date(2026, mesNum, 0).getDate()}`;

    if (kpi === "venda_mrr") {
      grupos = [itensParaGrupo("Deals recorrentes ganhos no mês", await dealsVendaDoMes(db, mesNum, "valor_recorrente"), base.realizado ?? 0)];
    } else if (kpi === "venda_pontual") {
      grupos = [itensParaGrupo("Deals pontuais ganhos no mês", await dealsVendaDoMes(db, mesNum, "valor_pontual"), base.realizado ?? 0)];
    } else if (kpi === "churn_mrr") {
      grupos = [itensParaGrupo("Contratos recorrentes cancelados no mês", await churnMrrDoMes(db, mesNum), base.realizado ?? 0)];
      nota = "Total = churn do mês (régua da célula). A lista detalha os contratos recorrentes cancelados no mês por data de encerramento — pode não somar exatamente o total.";
    } else if (kpi === "churn_pontual") {
      grupos = [itensParaGrupo("Contratos pontuais cancelados no mês", await churnPontualDoMes(db, mesNum), base.realizado ?? 0)];
      nota = "Total = churn pontual do mês (régua da célula). A lista detalha os contratos pontuais cancelados no mês por data de encerramento — pode não somar exatamente o total.";
    } else if (kpi === "cross_mrr" || kpi === "cross_pontual") {
      const det = await getCrosssellDealsDetail(ini, fim);
      const itens = det.items
        .map((d) => ({ nome: d.cliente, detalhe: d.closer && d.closer !== "—" ? `closer ${d.closer}` : "", data: d.data_fechamento, valor: kpi === "cross_mrr" ? d.recorrente : d.pontual }))
        .filter((it) => it.valor > 0);
      grupos = [itensParaGrupo("Deals de cross-sell/upsell no mês", itens, base.realizado ?? 0)];
    } else { // nrr | nrr_pontual — decomposição da erosão
      const ing = mov.ingredientes;
      const base_ = kpi === "nrr" ? ing.mrrInicioPorMes[mesNum] ?? 0 : ing.estoquePontIniPorMes[mesNum] ?? 0;
      const churn_ = kpi === "nrr" ? ing.churnMrrPorMes[mesNum] ?? 0 : ing.churnPontualPorMes[mesNum] ?? 0;
      const cross_ = kpi === "nrr" ? ing.crossMrrPorMes[mesNum] ?? 0 : ing.crossPontPorMes[mesNum] ?? 0;
      grupos = [
        { titulo: kpi === "nrr" ? "MRR do início do mês (base)" : "Estoque pontual inicial (base)", total: base_, formato: "brl", itens: [], aberto: true },
        { titulo: "Churn no mês", total: churn_, formato: "brl", sinal: "-", itens: [] },
        { titulo: "Cross-sell/Upsell no mês", total: cross_, formato: "brl", sinal: "+", itens: [] },
      ];
      const pct = base_ > 0 ? ((churn_ - cross_) / base_ * 100) : null;
      nota = `NRR (erosão) = (Churn ${formatBRL(churn_)} − Cross-sell ${formatBRL(cross_)}) ÷ base ${formatBRL(base_)} = ${pct == null ? "—" : pct.toFixed(1) + "%"}. Menor é melhor.`;
    }
  } else {
    throw new Error("kpi inválido");
  }

  const atingimentoPct = base.orcado != null && base.realizado != null && base.orcado !== 0
    ? Math.round((base.realizado / base.orcado) * 1000) / 10 : null;

  // Série de evolução mensal (realizado vs meta) p/ o gráfico do drawer.
  let evolucao: PontoEvolucao[] | undefined;
  if (kpi === "receita") {
    evolucao = serieEvolucao(receitaRecebidaFromBp(bp), bp.mesFechado);
  } else if (kpi === "receita_cabeca") {
    evolucao = serieEvolucao(receitaCabecaCaixaFromBp(bp), bp.mesFechado);
  } else if (EVOLUCAO_FONTE[kpi]) {
    const { arr, metrica } = EVOLUCAO_FONTE[kpi];
    evolucao = serieEvolucao((bp[arr] ?? []).find((l: any) => l.metrica === metrica), bp.mesFechado);
  } else if (linhaMovParaEvolucao) {
    evolucao = serieEvolucao(linhaMovParaEvolucao, bp.mesFechado);
    // Os 5 KPIs de movimento "semMeta" carregam um orcado:0 fake (BpLinha.meses.orcado não é
    // nullable); zerar aqui faria o gráfico desenhar uma linha de "Meta 0" espúria (0 != null).
    const SEM_META_MOV = new Set(["cross_mrr", "nrr", "churn_pontual", "cross_pontual", "nrr_pontual"]);
    if (SEM_META_MOV.has(kpi)) evolucao = evolucao.map((p) => ({ ...p, orcado: null }));
  }
  if (evolucao && evolucao.length < 2) evolucao = undefined; // 1 ponto não é evolução

  return { ...base, atingimentoPct, grupos, evolucao, nota, media, somaLtv, nClientes };
}

export function registerCeoDashboardDetalheRoutes(app: Express, db: any) {
  app.get("/api/ceo-dashboard/detalhe", async (req: any, res) => {
    try {
      if (!canAccessCeo(req.user)) return res.status(403).json({ error: "Acesso restrito ao CEO Dashboard" });
      const kpi = typeof req.query.kpi === "string" ? req.query.kpi : "";
      const KPIS_VALIDOS = ["receita","custos","lucro","geracao_caixa","caixa","inadimplencia","cac","cac_por_cliente","cac_por_contrato","ltv_fat","ltv_dfc","headcount","enps","receita_cabeca",
        "venda_mrr","churn_mrr","cross_mrr","nrr","venda_pontual","churn_pontual","cross_pontual","nrr_pontual"];
      if (!kpi || kpi === "nps" || !KPIS_VALIDOS.includes(kpi)) return res.status(400).json({ error: "kpi inválido" });
      const mes = typeof req.query.mes === "string" ? req.query.mes : undefined;
      const payload = await buildCeoDetalhe(db, kpi, mes);
      res.json(payload);
    } catch (error) {
      console.error("[api] Error building CEO detalhe:", error);
      res.status(500).json({ error: "Falha ao montar o detalhe do CEO Dashboard" });
    }
  });
}

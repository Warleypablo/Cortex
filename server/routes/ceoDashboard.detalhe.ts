import type { Express } from "express";
import { sql } from "drizzle-orm";
import { montarDetalheBp } from "./bp2026.detalhe";
import { computarBpReceitas } from "./bp2026";
import { storage } from "../storage";
import { canAccessCeo, parseMesNum, receitaCabecaCaixaFromBp, receitaRecebidaFromBp } from "./ceoDashboard.helpers";
import {
  achatarComponente, mapDetalheBpGrupos, bancosToGrupo, inadClientesToGrupos,
  enpsRespostasToGrupos, ltvRowsToGrupos, grupoMargemBruta, receitaCabecaGrupos,
  recebidoCategoriasToGrupo, serieEvolucao, KPI_COMPONENTES,
  type CeoGrupo, type CeoDetalheResponse, type PontoEvolucao,
} from "./ceoDashboard.detalhe.helpers";

// Fonte da série mensal (realizado vs meta) por KPI — só os que têm evolução no BP.
// receita e receita_cabeca usam as linhas sintéticas de caixa (montadas à parte).
const EVOLUCAO_FONTE: Record<string, { arr: "linhas" | "metricasGerais"; metrica: string }> = {
  custos: { arr: "metricasGerais", metrica: "despesa_total" },
  lucro: { arr: "linhas", metrica: "ebitda" },
  caixa: { arr: "metricasGerais", metrica: "saldo_caixa" },
  cac: { arr: "linhas", metrica: "cac" },
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

const TITULOS: Record<string, string> = {
  receita: "Receita", custos: "Custos & Despesas", lucro: "Lucro (EBITDA)",
  caixa: "Saldo de Caixa", inadimplencia: "Inadimplência Total", cac: "CAC",
  ltv: "LTV", headcount: "Headcount", enps: "E-NPS", receita_cabeca: "Receita / Cabeça",
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
    nota = "EBITDA = Margem Bruta − CAC − SG&A − Bônus";
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
  } else if (kpi === "ltv") {
    const rows: any = await db.execute(sql`
      SELECT COALESCE(c.nome, t.id_task) AS nome, t.ltv_total FROM (
        SELECT id_task, SUM(COALESCE(ltv_recorrente,0)) + SUM(COALESCE(valorp,0)) AS ltv_total
        FROM cortex_core.vw_lt_contratos GROUP BY id_task
      ) t LEFT JOIN "Clickup".cup_clientes c ON c.task_id = t.id_task
      ORDER BY t.ltv_total DESC NULLS LAST LIMIT 200`);
    grupos = ltvRowsToGrupos(rows.rows ?? []);
    nota = "O card mostra a MÉDIA de LTV por cliente; abaixo, o LTV de cada cliente.";
  } else if (kpi === "enps") {
    const respostas: any = await storage.getRhNpsRespostas();
    grupos = enpsRespostasToGrupos(respostas ?? []);
    nota = "E-NPS (empresa) — todas as respostas disponíveis.";
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
  }
  if (evolucao && evolucao.length < 2) evolucao = undefined; // 1 ponto não é evolução

  return { ...base, atingimentoPct, grupos, evolucao, nota };
}

export function registerCeoDashboardDetalheRoutes(app: Express, db: any) {
  app.get("/api/ceo-dashboard/detalhe", async (req: any, res) => {
    try {
      if (!canAccessCeo(req.user)) return res.status(403).json({ error: "Acesso restrito ao CEO Dashboard" });
      const kpi = typeof req.query.kpi === "string" ? req.query.kpi : "";
      const KPIS_VALIDOS = ["receita","custos","lucro","caixa","inadimplencia","cac","ltv","headcount","enps","receita_cabeca"];
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

import type { Express } from "express";
import { sql } from "drizzle-orm";
import { montarDetalheBp } from "./bp2026.detalhe";
import { computarBpReceitas } from "./bp2026";
import { storage } from "../storage";
import { canAccessCeo, parseMesNum, receitaCabecaCaixaFromBp, receitaRecebidaFromBp } from "./ceoDashboard.helpers";
import {
  achatarComponente, mapDetalheBpGrupos, bancosToGrupo, inadClientesToGrupos,
  enpsRespostasToGrupos, grupoMargemBruta, receitaCabecaGrupos,
  recebidoCategoriasToGrupo, serieEvolucao, KPI_COMPONENTES,
  ltvAuditoriaToGrupos, ultimoDiaAnterior,
  type CeoGrupo, type CeoDetalheResponse, type PontoEvolucao, type LtvAuditoriaRow,
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
  ltv_fat: "LTV FAT", ltv_dfc: "LTV DFC", headcount: "Headcount", enps: "E-NPS", receita_cabeca: "Receita / Cabeça",
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
    const regua = kpi === "ltv_fat"
      ? "Régua FAT (faturável): Valor R × meses de vida até o snapshot + pontual entregue"
      : `Régua DFC (caixa): faturável teórico até 30/set/25 + pago real no Conta Azul via CNPJ (parcelas RECEITA quitadas até ${ultimoDiaAnterior(mesNum)})${aud.nSemMatch > 0 ? `; ${aud.nSemMatch} cliente${aud.nSemMatch === 1 ? "" : "s"} sem match CNPJ usa${aud.nSemMatch === 1 ? "" : "m"} a régua faturável` : ""}`;
    nota = `Célula = MEDIANA de ${parsed.length} clientes ativos no 1º snapshot de ${String(mesNum).padStart(2, "0")}/2026 (N par = média dos 2 centrais). ${regua}.`;
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
      const KPIS_VALIDOS = ["receita","custos","lucro","caixa","inadimplencia","cac","ltv_fat","ltv_dfc","headcount","enps","receita_cabeca"];
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

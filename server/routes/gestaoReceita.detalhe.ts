// server/routes/gestaoReceita.detalhe.ts
// Drill-down da página Gestão de Receita: dado um (tipo, chave, mês), monta a lista
// de itens que compõem aquele número, no mesmo formato do BP (grupos + itens).
import { sql } from "drizzle-orm";
import { agruparItens, type ItemDetalhe, type GrupoDetalhe } from "./bp2026.helpers";
import { PREDICADOS_DESPESA, PREDICADOS_CAC_SUB } from "./bp2026.predicados";
import { sourceLabel } from "./bitrixSources";
import { segPredSql, filtrosFunilSql, PLATAFORMA_LABELS } from "./gestaoReceita.funil";

const LIMITE = 50;
const STAGE_GANHO = "Negócio Ganho";

export interface DetalheResult {
  titulo: string;
  subtitulo: string;
  total: number;
  unidade: "brl" | "int";
  grupos: GrupoDetalhe[];
  nota?: string;
}

const TIPOS = new Set([
  "venda_mrr", "venda_pontual", "canal", "closer", "sdr", "funil_etapa", "mql",
  "produto", "churn_motivo", "churn_vendedor", "cac", "custo_comercial", "comissoes", "cac_sub",
]);

// rótulos das sub-linhas do CAC no drill (chave = predicado em PREDICADOS_CAC_SUB)
const CAC_SUB_LABELS: Record<string, string> = {
  cac_growth: "Growth", cac_ads: "ADs", cac_pre_vendas: "Pré-vendas",
  cac_vendas: "Vendas", cac_gerencia: "Gerência", cac_eventos: "Eventos",
};
export const tipoValido = (t: unknown): t is string => typeof t === "string" && TIPOS.has(t);

const brl = (n: number) => "R$ " + Math.round(n).toLocaleString("pt-BR");
const num = (v: any) => (v == null ? 0 : parseFloat(v) || 0);

async function rows(db: any, q: ReturnType<typeof sql>): Promise<any[]> {
  return ((await db.execute(q)).rows as any[]) || [];
}

// Monta o resultado a partir de uma lista de itens (valor em R$) ou de contagem (valor=0).
function montar(titulo: string, itens: ItemDetalhe[], unidade: "brl" | "int", nota?: string): DetalheResult {
  const grupos = agruparItens(itens, LIMITE);
  const total = unidade === "int" ? itens.length : itens.reduce((s, i) => s + i.valor, 0);
  const subtitulo = unidade === "int" ? `${total.toLocaleString("pt-BR")} itens` : brl(total);
  return { titulo, subtitulo, total, unidade, grupos, ...(nota ? { nota } : {}) };
}

export async function montarDetalhe(
  db: any,
  { tipo, chave, dIni, dFim, label, produto, plataforma }:
    { tipo: string; chave: string; dIni: string; dFim: string; label: string; produto?: string; plataforma?: string }
): Promise<DetalheResult> {
  // ---------- Família DEALS (Bitrix) ----------
  const dealBase = (where: ReturnType<typeof sql>, valorExpr: ReturnType<typeof sql>, dataExpr: ReturnType<typeof sql>, grupoExpr: ReturnType<typeof sql>) =>
    sql`SELECT d.title AS nome, ${grupoExpr} AS grupo, ${dataExpr}::date::text AS data, ${valorExpr} AS valor
        FROM "Bitrix".crm_deal d
        LEFT JOIN "Bitrix".crm_closers c ON c.id::text = d.closer::text
        LEFT JOIN "Bitrix".crm_users u ON u.id::text = d.sdr::text
        WHERE ${where}`;
  const ganhoNoMes = sql`d.stage_name = ${STAGE_GANHO} AND d.data_fechamento >= ${dIni} AND d.data_fechamento < ${dFim}`;
  const grpCloser = sql`COALESCE(NULLIF(c.nome, ''), '(sem closer)')`;
  const grpCanal = sql`COALESCE(NULLIF(d.source, ''), '(não informado)')`;
  const valMrrPont = sql`(COALESCE(d.valor_recorrente::numeric, 0) + COALESCE(d.valor_pontual::numeric, 0))`;
  const toDealItens = (rs: any[], detalhe = "", labelGrupo?: (g: string) => string): ItemDetalhe[] =>
    rs.map((r) => ({ grupo: labelGrupo ? labelGrupo(r.grupo) : r.grupo, nome: r.nome || "(sem título)", detalhe, data: r.data, valor: num(r.valor) }));

  if (tipo === "venda_mrr") {
    const rs = await rows(db, dealBase(sql`${ganhoNoMes} AND COALESCE(d.valor_recorrente::numeric, 0) > 0`, sql`d.valor_recorrente::numeric`, sql`d.data_fechamento`, grpCloser));
    return montar(`Venda de MRR · ${label}`, toDealItens(rs, "MRR"), "brl");
  }
  if (tipo === "venda_pontual") {
    const rs = await rows(db, dealBase(sql`${ganhoNoMes} AND COALESCE(d.valor_pontual::numeric, 0) > 0`, sql`d.valor_pontual::numeric`, sql`d.data_fechamento`, grpCloser));
    return montar(`Venda Pontual · ${label}`, toDealItens(rs, "Pontual"), "brl");
  }
  if (tipo === "canal") {
    const filtroCanal = chave === "(não informado)" ? sql`COALESCE(NULLIF(d.source, ''), '(não informado)') = '(não informado)'` : sql`d.source = ${chave}`;
    const rs = await rows(db, dealBase(sql`${ganhoNoMes} AND ${filtroCanal}`, valMrrPont, sql`d.data_fechamento`, grpCloser));
    return montar(`Canal: ${sourceLabel(chave)} · ${label}`, toDealItens(rs), "brl");
  }
  if (tipo === "closer") {
    const rs = await rows(db, dealBase(sql`${ganhoNoMes} AND c.nome = ${chave}`, valMrrPont, sql`d.data_fechamento`, grpCanal));
    return montar(`Closer: ${chave} · ${label}`, toDealItens(rs), "brl");
  }
  if (tipo === "sdr") {
    const rs = await rows(db, dealBase(sql`${ganhoNoMes} AND u.nome = ${chave}`, valMrrPont, sql`d.data_fechamento`, grpCloser));
    return montar(`SDR: ${chave} · ${label}`, toDealItens(rs), "brl", "Valor das vendas ganhas atribuídas ao SDR (o mesmo deal também conta para o closer).");
  }
  if (tipo === "funil_etapa") {
    // chave pode vir como "inbound:lead" / "outbound:venda" / "outros:rr" ou só "lead"
    const [maybeSeg, maybeEtapa] = chave.includes(":") ? chave.split(":") : ["", chave];
    const etapa = maybeEtapa;
    const segRotulo = maybeSeg ? ` (${maybeSeg})` : "";
    // mesma régua do agregador (gestaoReceita.funil.ts) + filtros Produto × Plataforma
    const segFiltro = maybeSeg ? sql` AND ${segPredSql(maybeSeg, "d")}` : sql``;
    const extras = sql`${segFiltro}${filtrosFunilSql({ produto, plataforma }, "d")}`;
    const notaFiltro = produto || plataforma
      ? `Filtros ativos — ${[produto ? `produto: ${produto}` : "", plataforma ? `plataforma: ${PLATAFORMA_LABELS[plataforma] || plataforma}` : ""].filter(Boolean).join(" · ")}.`
      : undefined;
    if (etapa === "venda") {
      const rs = await rows(db, dealBase(sql`${ganhoNoMes}${extras}`, valMrrPont, sql`d.data_fechamento`, grpCloser));
      return montar(`Funil${segRotulo} · Venda · ${label}`, toDealItens(rs), "brl", notaFiltro);
    }
    const mapa: Record<string, { campo: ReturnType<typeof sql>; rotulo: string }> = {
      lead: { campo: sql`d.date_create`, rotulo: "Lead" },
      ra: { campo: sql`d.data_reuniao_agendada`, rotulo: "Reunião agendada" },
      rr: { campo: sql`d.data_reuniao_realizada`, rotulo: "Reunião realizada" },
    };
    const m = mapa[etapa];
    if (!m) return montar("Funil", [], "int");
    const rs = await rows(db, dealBase(sql`${m.campo} >= ${dIni} AND ${m.campo} < ${dFim}${extras}`, sql`0::numeric`, m.campo, grpCanal));
    return montar(`Funil${segRotulo} · ${m.rotulo} · ${label}`, toDealItens(rs, "", sourceLabel).map((i) => ({ ...i, valor: 0 })), "int", notaFiltro);
  }
  if (tipo === "mql") {
    const classeExpr = sql`CASE WHEN d.mql::text = '1' OR lower(d.mql::text) = 'true' THEN 'MQL'
      WHEN d.mql IS NULL OR d.mql::text = '' THEN '(sem classificação)' ELSE 'NMQL' END`;
    const rs = await rows(db, dealBase(sql`d.date_create >= ${dIni} AND d.date_create < ${dFim} AND ${classeExpr} = ${chave}`, sql`0::numeric`, sql`d.date_create`, grpCanal));
    return montar(`MQL: ${chave} · ${label}`, toDealItens(rs, "", sourceLabel).map((i) => ({ ...i, valor: 0 })), "int");
  }

  // ---------- Família PRODUTO (ClickUp) ----------
  if (tipo === "produto") {
    const rs = await rows(db, sql`
      SELECT ct.servico AS nome, COALESCE(NULLIF(TRIM(ct.status), ''), '(sem status)') AS grupo,
             ct.data_criado::date::text AS data, cl.nome AS cliente,
             (GREATEST(COALESCE(ct.valorr::numeric, 0), 0) + GREATEST(COALESCE(ct.valorp::numeric, 0), 0)) AS valor
      FROM "Clickup".cup_contratos ct
      LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = ct.id_task
      WHERE COALESCE(NULLIF(TRIM(ct.produto), ''), '(sem produto)') = ${chave}
        AND ct.data_criado >= ${dIni} AND ct.data_criado < ${dFim}
        AND LOWER(TRIM(ct.status)) <> 'não usar'
      ORDER BY valor DESC`);
    const itens: ItemDetalhe[] = rs.map((r) => ({ grupo: r.grupo, nome: r.nome || "(sem serviço)", detalhe: r.cliente || "", data: r.data, valor: num(r.valor) }));
    return montar(`Produto: ${chave} · ${label}`, itens, "brl", "Contratos/entregas operacionais do mês (por status). O pontual aqui aparece por entrega — a célula deduplica por jornada, então o total pode diferir.");
  }

  // ---------- Família CHURN (ClickUp) ----------
  // cup_churn.nome é o SERVIÇO (subtask); o cliente vem via parent_id -> cup_clientes.task_id.
  if (tipo === "churn_motivo" || tipo === "churn_vendedor") {
    const filtro = tipo === "churn_motivo"
      ? sql`COALESCE(NULLIF(ch.motivo_cancelamento, ''), '(sem motivo)') = ${chave}`
      : sql`COALESCE(NULLIF(ch.vendedor, ''), '(sem vendedor)') = ${chave}`;
    const rs = await rows(db, sql`
      SELECT ch.nome AS servico, cl.nome AS cliente,
             COALESCE(NULLIF(ch.vendedor, ''), '(sem vendedor)') AS vendedor,
             COALESCE(NULLIF(ch.motivo_cancelamento, ''), '(sem motivo)') AS motivo,
             NULLIF(ch.submotivo_cancelamento, '') AS submotivo,
             ch.data_solicitacao_encerramento::date::text AS data, COALESCE(ch.valor_r::numeric, 0) AS valor
      FROM "Clickup".cup_churn ch
      LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = ch.parent_id
      WHERE ch.data_solicitacao_encerramento >= ${dIni} AND ch.data_solicitacao_encerramento < ${dFim} AND ${filtro}
      ORDER BY valor DESC`);
    const itens: ItemDetalhe[] = rs.map((r) => {
      const sub = r.submotivo && r.submotivo !== r.motivo ? r.submotivo : "";
      const [grupo, detalhe] = tipo === "churn_vendedor"
        ? [r.cliente || "(sem cliente)", [r.motivo, sub].filter(Boolean).join(" · ")]
        : [r.vendedor, [r.cliente || "(sem cliente)", sub].filter(Boolean).join(" · ")];
      return { grupo, nome: r.servico || "(sem serviço)", detalhe, data: r.data, valor: num(r.valor) };
    });
    const titulo = tipo === "churn_motivo" ? `Churn · ${chave} · ${label}` : `Churn · vendedor ${chave} · ${label}`;
    return montar(titulo, itens, "brl");
  }

  // ---------- Família CUSTOS (Conta Azul, regime caixa) ----------
  if (tipo === "cac" || tipo === "custo_comercial" || tipo === "comissoes" || tipo === "cac_sub") {
    // cac_sub: chave vem do cliente — só aceita predicados whitelisted (hasOwnProperty
    // evita cair no prototype com chaves como "constructor").
    const predicado =
      tipo === "cac" ? PREDICADOS_DESPESA.cac :
      tipo === "comissoes" ? PREDICADOS_CAC_SUB.cac_comissoes :
      tipo === "cac_sub" ? (Object.prototype.hasOwnProperty.call(PREDICADOS_CAC_SUB, chave) ? PREDICADOS_CAC_SUB[chave] : undefined) :
      sql`(${PREDICADOS_CAC_SUB.cac_vendas}) OR (${PREDICADOS_CAC_SUB.cac_pre_vendas})`;
    if (!predicado) return montar(`CAC · ${chave} · ${label}`, [], "brl");
    const rs = await rows(db, sql`
      SELECT COALESCE(NULLIF(TRIM(nome), ''), NULLIF(TRIM(descricao), ''), '(sem descrição)') AS nome,
             COALESCE(NULLIF(TRIM(categoria_nome), ''), '(sem categoria)') AS grupo,
             data_quitacao::date::text AS data, COALESCE(valor_pago::numeric, 0) AS valor
      FROM "Conta Azul".caz_parcelas
      WHERE tipo_evento = 'DESPESA' AND status = 'QUITADO'
        AND data_quitacao >= ${dIni} AND data_quitacao < ${dFim}
        AND (${predicado})
      ORDER BY valor DESC`);
    const itens: ItemDetalhe[] = rs.map((r) => ({ grupo: r.grupo, nome: r.nome, detalhe: "", data: r.data, valor: num(r.valor) }));
    const titulo =
      tipo === "cac" ? `CAC (custo total) · ${label}` :
      tipo === "comissoes" ? `Comissões · ${label}` :
      tipo === "cac_sub" ? `CAC · ${CAC_SUB_LABELS[chave] || chave} · ${label}` :
      `Custo comercial · ${label}`;
    return montar(titulo, itens, "brl");
  }

  return montar("Detalhe", [], "brl");
}

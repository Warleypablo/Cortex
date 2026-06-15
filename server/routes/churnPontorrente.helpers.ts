// Lógica pura do churn de contratos ponto-recorrentes (pontorrentes).
// Os endpoints buscam as linhas cruas de cup_contratos (servico ILIKE '%entrega%')
// e delegam toda a regra de negócio para estas funções (testáveis sem banco).

export type Situacao = "entregue" | "em_andamento" | "churn";

// "Entrega 1", "Entrega 01" (número depois, com zero à esquerda)
const RE_DEPOIS = /entrega\s*0*(\d+)/i;
// "1ª Entrega", "4 entregas" (número antes, ordinal opcional)
const RE_ANTES = /(\d+)\s*ª?\s*entrega/i;

/** Extrai o número da entrega (1..N) do campo `servico`, ou null se não houver. */
export function extractNivelEntrega(servico: string | null | undefined): number | null {
  if (!servico) return null;
  const m1 = servico.match(RE_DEPOIS);
  if (m1) return parseInt(m1[1], 10);
  const m2 = servico.match(RE_ANTES);
  if (m2) return parseInt(m2[1], 10);
  return null;
}

/** Classifica o status do ClickUp em situação de jornada. */
export function classifySituacao(status: string | null | undefined): Situacao {
  const s = (status ?? "").trim().toLowerCase();
  if (s === "entregue") return "entregue";
  if (s === "cancelado/inativo" || s === "não usar") return "churn";
  return "em_andamento";
}

export interface RawRow {
  idTask: string | null;
  produto: string | null;
  servico: string;
  status: string | null;
  valorp: number | null;
  squad: string | null;
  responsavel: string | null;
  csResponsavel: string | null;
  vendedor: string | null;
  motivoCancelamento: string | null;
  dataInicio: string | null;        // 'YYYY-MM-DD'
  dataEncerramento: string | null;  // data_solicitacao_encerramento, 'YYYY-MM-DD'
  nomeCliente: string | null;
}

export interface Jornada {
  idTask: string;
  produto: string;
  nomeCliente: string | null;
  nivelMax: number;
  situacaoFinal: Situacao;
  valorp: number;
  squad: string | null;
  responsavel: string | null;
  csResponsavel: string | null;
  vendedor: string | null;
  motivoCancelamento: string | null;
  dataInicioPrimeira: string | null;
  dataEncerramento: string | null;
}

export interface Filtros {
  produto?: string;
  squad?: string;
  responsavel?: string;
  de?: string;   // 'YYYY-MM' (mês de início >=)
  ate?: string;  // 'YYYY-MM' (mês de início <=)
}

/** Agrupa as linhas em jornadas (id_task × produto), conforme a base do funil. */
export function toJornadas(rows: RawRow[], base: "vendido" | "entregue"): Jornada[] {
  const groups = new Map<string, RawRow[]>();
  for (const r of rows) {
    if (extractNivelEntrega(r.servico) == null) continue;
    if (!r.idTask || !r.produto) continue;
    const key = `${r.idTask}|||${r.produto}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
  }

  const jornadas: Jornada[] = [];
  for (const [key, stages] of Array.from(groups.entries())) {
    const elegiveis = base === "entregue"
      ? stages.filter((s) => classifySituacao(s.status) === "entregue")
      : stages;
    if (elegiveis.length === 0) continue;

    let topo = elegiveis[0];
    let topoNivel = extractNivelEntrega(topo.servico)!;
    for (const s of elegiveis) {
      const n = extractNivelEntrega(s.servico)!;
      if (n > topoNivel || (n === topoNivel && (s.valorp ?? 0) > (topo.valorp ?? 0))) {
        topo = s; topoNivel = n;
      }
    }

    const datasInicio = stages
      .map((s) => s.dataInicio)
      .filter((d): d is string => !!d)
      .sort();
    const [idTask, produto] = key.split("|||");
    jornadas.push({
      idTask, produto,
      nomeCliente: topo.nomeCliente,
      nivelMax: topoNivel,
      situacaoFinal: classifySituacao(topo.status),
      valorp: topo.valorp ?? 0,
      squad: topo.squad,
      responsavel: topo.responsavel,
      csResponsavel: topo.csResponsavel,
      vendedor: topo.vendedor,
      motivoCancelamento: topo.motivoCancelamento,
      dataInicioPrimeira: datasInicio[0] ?? null,
      dataEncerramento: topo.dataEncerramento,
    });
  }
  return jornadas;
}

/** Filtra jornadas por produto/squad/responsável/mês de início. */
export function applyFiltros(jornadas: Jornada[], f: Filtros): Jornada[] {
  return jornadas.filter((j) => {
    if (f.produto && f.produto !== "todos" && j.produto !== f.produto) return false;
    if (f.squad && f.squad !== "todos" && j.squad !== f.squad) return false;
    if (f.responsavel && f.responsavel !== "todos" && j.responsavel !== f.responsavel) return false;
    const mes = j.dataInicioPrimeira ? j.dataInicioPrimeira.slice(0, 7) : null;
    if (f.de && (!mes || mes < f.de)) return false;
    if (f.ate && (!mes || mes > f.ate)) return false;
    return true;
  });
}

export interface FunilNivel {
  nivel: number;
  atingiram: number;     // jornadas com nivelMax >= nivel
  pararamAqui: number;   // nivelMax === nivel
  churn: number;
  emAndamento: number;
  concluido: number;
  valorpChurn: number;
  dropPct: number;       // queda % para o próximo degrau (0 no último)
}

export function buildFunil(jornadas: Jornada[]): FunilNivel[] {
  if (jornadas.length === 0) return [];
  const maxNivel = Math.max(...jornadas.map((j) => j.nivelMax));
  const niveis: FunilNivel[] = [];
  for (let n = 1; n <= maxNivel; n++) {
    const pararam = jornadas.filter((j) => j.nivelMax === n);
    niveis.push({
      nivel: n,
      atingiram: jornadas.filter((j) => j.nivelMax >= n).length,
      pararamAqui: pararam.length,
      churn: pararam.filter((j) => j.situacaoFinal === "churn").length,
      emAndamento: pararam.filter((j) => j.situacaoFinal === "em_andamento").length,
      concluido: pararam.filter((j) => j.situacaoFinal === "entregue").length,
      valorpChurn: pararam
        .filter((j) => j.situacaoFinal === "churn")
        .reduce((a, j) => a + j.valorp, 0),
      dropPct: 0,
    });
  }
  for (let i = 0; i < niveis.length - 1; i++) {
    const cur = niveis[i].atingiram;
    const next = niveis[i + 1].atingiram;
    niveis[i].dropPct = cur > 0 ? Math.round(((cur - next) / cur) * 1000) / 10 : 0;
  }
  return niveis;
}

export interface Overview {
  jornadas: number;
  retencaoUltima: number;
  dropMedio: number;
  churnConfirmado: number;
  valorpPerdido: number;
}

export function buildOverview(jornadas: Jornada[]): Overview {
  const funil = buildFunil(jornadas);
  const nivel1 = funil[0]?.atingiram ?? 0;
  const ultimo = funil[funil.length - 1]?.atingiram ?? 0;
  const drops = funil.slice(0, -1).map((n) => n.dropPct);
  const dropMedio = drops.length
    ? Math.round((drops.reduce((a, b) => a + b, 0) / drops.length) * 10) / 10
    : 0;
  const churned = jornadas.filter((j) => j.situacaoFinal === "churn");
  return {
    jornadas: jornadas.length,
    retencaoUltima: nivel1 > 0 ? Math.round((ultimo / nivel1) * 1000) / 10 : 0,
    dropMedio,
    churnConfirmado: churned.length,
    valorpPerdido: churned.reduce((a, j) => a + j.valorp, 0),
  };
}

export type Dim = "motivo" | "squad" | "responsavel" | "cs";
export interface DimRow { label: string; qtd: number; valorp: number; }

export function aggregateChurnPorDimensao(jornadas: Jornada[], dim: Dim): DimRow[] {
  const pick = (j: Jornada): string => {
    const v = dim === "motivo" ? j.motivoCancelamento
      : dim === "squad" ? j.squad
      : dim === "responsavel" ? j.responsavel
      : j.csResponsavel;
    const t = (v ?? "").trim();
    return t === "" ? "(não informado)" : t;
  };
  const map = new Map<string, DimRow>();
  for (const j of jornadas.filter((x) => x.situacaoFinal === "churn")) {
    const label = pick(j);
    const cur = map.get(label) ?? { label, qtd: 0, valorp: 0 };
    cur.qtd += 1;
    cur.valorp += j.valorp;
    map.set(label, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.qtd - a.qtd || b.valorp - a.valorp);
}

export interface DetalheRow {
  nomeCliente: string | null;
  produto: string;
  nivelCaiu: number;
  motivo: string | null;
  responsavel: string | null;
  cs: string | null;
  squad: string | null;
  vendedor: string | null;
  valorp: number;
  dataEncerramento: string | null;
}

export function buildDetalhamento(jornadas: Jornada[]): DetalheRow[] {
  return jornadas
    .filter((j) => j.situacaoFinal === "churn")
    .map((j) => ({
      nomeCliente: j.nomeCliente,
      produto: j.produto,
      nivelCaiu: j.nivelMax,
      motivo: j.motivoCancelamento,
      responsavel: j.responsavel,
      cs: j.csResponsavel,
      squad: j.squad,
      vendedor: j.vendedor,
      valorp: j.valorp,
      dataEncerramento: j.dataEncerramento,
    }))
    .sort((a, b) => b.valorp - a.valorp);
}

export interface ChurnPontorrentePayload {
  overview: Overview;
  funil: FunilNivel[];
  churnPorDimensao: { motivo: DimRow[]; squad: DimRow[]; responsavel: DimRow[]; cs: DimRow[] };
  detalhamento: DetalheRow[];
  filtrosDisponiveis: { produtos: string[]; squads: string[]; responsaveis: string[] };
}

function distinctSorted(values: (string | null)[]): string[] {
  const set = new Set<string>();
  for (const v of values) { const t = (v ?? "").trim(); if (t) set.add(t); }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function buildPayload(
  rows: RawRow[],
  base: "vendido" | "entregue",
  filtros: Filtros,
): ChurnPontorrentePayload {
  const todas = toJornadas(rows, base);
  const filtrosDisponiveis = {
    produtos: distinctSorted(todas.map((j) => j.produto)),
    squads: distinctSorted(todas.map((j) => j.squad)),
    responsaveis: distinctSorted(todas.map((j) => j.responsavel)),
  };
  const jornadas = applyFiltros(todas, filtros);
  return {
    overview: buildOverview(jornadas),
    funil: buildFunil(jornadas),
    churnPorDimensao: {
      motivo: aggregateChurnPorDimensao(jornadas, "motivo"),
      squad: aggregateChurnPorDimensao(jornadas, "squad"),
      responsavel: aggregateChurnPorDimensao(jornadas, "responsavel"),
      cs: aggregateChurnPorDimensao(jornadas, "cs"),
    },
    detalhamento: buildDetalhamento(jornadas),
    filtrosDisponiveis,
  };
}

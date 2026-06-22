// server/routes/creatorsModelo.helpers.ts
import {
  extractNivelEntrega, toJornadas, buildFunil,
  type RawRow as PontRawRow, type FunilNivel,
} from "./churnPontorrente.helpers";
import { mediana } from "./ltLtvChurn.helpers";

export interface RawRow {
  idTask: string | null;
  idSubtask: string | null;
  produto: string | null;
  servico: string;
  status: string | null;
  tipoReceita: string | null;       // 'recorrente' | 'pontual' | 'sem_valor'
  valorr: number;
  valorp: number;
  ltMeses: number | null;           // já calculado na view (recorrente)
  ltvRecorrente: number | null;     // já = valorr * ltMeses (realizado até hoje)
  isAtivo: boolean;
  isChurned: boolean;
  dataInconsistente: boolean;
  dataInicio: string | null;        // 'YYYY-MM-DD'
  dataFim: string | null;           // 'YYYY-MM-DD'
}

export type Modelo = "recorrente" | "pontual";
export type EstadoRec = "ativo" | "cancelado";
export type EstadoPont = "em_producao" | "concluido" | "cancelado";

export function classifyModelo(r: RawRow): Modelo | null {
  if (r.tipoReceita === "recorrente") return "recorrente";
  if (r.tipoReceita === "pontual") return "pontual";
  return null;
}

/**
 * Recorrente: ativo (assinatura viva) / cancelado / null (descartar).
 * Bug #1: status 'entregue'/'em cancelamento' com ltv_recorrente NULL NÃO são
 * "ativo" — a view marca como não-churned, mas não têm valor realizado. Usa
 * is_ativo (status ativo/onboarding/triagem/pausado) para o balde ativo.
 */
export function classifyEstadoRecorrente(r: RawRow): "ativo" | "cancelado" | null {
  if (r.isChurned) return "cancelado";
  if (r.isAtivo) return "ativo";
  return null; // fantasma (ex.: recorrente 'entregue') — fora dos baldes
}

/** Pontual: 3 estados. 'entregue'=sucesso, cancelado/inativo|não usar=churn, resto=em produção. */
export function classifyEstadoPontual(status: string | null): EstadoPont {
  const s = (status ?? "").trim().toLowerCase();
  if (s === "entregue") return "concluido";
  if (s === "cancelado/inativo" || s === "não usar") return "cancelado";
  return "em_producao";
}

/** Contrato pontual com número de entrega no serviço (jornada sequenciada). */
export function isSequenciado(servico: string | null): boolean {
  if (!servico) return false;
  if (/rótulos/i.test(servico)) return false;
  return extractNivelEntrega(servico) != null;
}

// ─── Task 2: unidades e agregação ────────────────────────────────────────────

const DIAS_MES = 30.44;

export interface Unit {
  estado: EstadoRec | EstadoPont;
  lt: number | null;     // recorrente: meses; pontual: span em meses; null = não conta na média de LT
  nEntregas: number;     // 0 para recorrente
  ltv: number;
  idadeMeses: number;
}

export interface Metricas {
  n: number;
  ltMesesMedia: number; ltMesesMediana: number;
  nEntregasMedia: number; nEntregasMediana: number;
  ltvMedia: number; ltvMediana: number;
  ltvTotal: number;
  idadeMediaMeses: number;
}

/** Meses (de 30.44 dias) entre duas datas 'YYYY-MM-DD'; 0 se ate < de. */
export function mesesEntre(de: string, ate: string): number {
  const a = Date.parse(de), b = Date.parse(ate);
  if (isNaN(a) || isNaN(b) || b < a) return 0;
  return (b - a) / (1000 * 60 * 60 * 24) / DIAS_MES;
}

function round1(n: number) { return Math.round(n * 10) / 10; }
function round0(n: number) { return Math.round(n); }
function avg(a: number[]) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0; }

export function buildUnitsRecorrente(
  rows: RawRow[], unidade: "cliente" | "contrato", hoje: string,
): Unit[] {
  if (unidade === "contrato") {
    return rows
      .map((r) => ({ r, estado: classifyEstadoRecorrente(r) }))
      .filter((x): x is { r: RawRow; estado: "ativo" | "cancelado" } => x.estado !== null)
      .map(({ r, estado }) => ({
        estado,
        lt: r.dataInconsistente || r.ltMeses == null ? null : r.ltMeses,
        nEntregas: 0,
        ltv: r.ltvRecorrente ?? 0,
        idadeMeses: r.dataInicio ? mesesEntre(r.dataInicio, hoje) : 0,
      }));
  }
  // por cliente: agrega por idTask
  const byCli = new Map<string, RawRow[]>();
  for (const r of rows) {
    const k = r.idTask ?? r.idSubtask ?? "";
    (byCli.get(k) ?? byCli.set(k, []).get(k)!).push(r);
  }
  const units: Unit[] = [];
  for (const [, items] of Array.from(byCli.entries())) {
    const temAtivo = items.some((r) => classifyEstadoRecorrente(r) === "ativo");
    const temCancelado = items.some((r) => classifyEstadoRecorrente(r) === "cancelado");
    if (!temAtivo && !temCancelado) continue; // cliente só com fantasmas → fora
    const ativo = temAtivo;
    const inicios = items.map((r) => r.dataInicio).filter((d): d is string => !!d).sort();
    // Cancelados: só data_fim de contratos consistentes (data_inconsistente =
    // data_fim < data_inicio corrompe o span). Espelha a régua de ltLtvChurn
    // (MAX(data_fim) FILTER NOT data_inconsistente).
    const finsValidos = items
      .filter((r) => !r.dataInconsistente)
      .map((r) => r.dataFim)
      .filter((d): d is string => !!d)
      .sort();
    const ini = inicios[0] ?? null;
    let lt: number | null = null;
    if (ini) {
      if (ativo) {
        lt = mesesEntre(ini, hoje);
      } else {
        const fim = finsValidos[finsValidos.length - 1] ?? null;
        lt = fim && fim >= ini ? mesesEntre(ini, fim) : null;
      }
    }
    units.push({
      estado: ativo ? "ativo" : "cancelado",
      lt,
      nEntregas: 0,
      ltv: items.reduce((s, r) => s + (r.ltvRecorrente ?? 0), 0),
      idadeMeses: ini ? mesesEntre(ini, hoje) : 0,
    });
  }
  return units;
}

/** Prioridade de estado do cliente pontual: em produção > cancelado > concluído. */
function estadoClientePontual(items: RawRow[]): EstadoPont {
  const estados = items.map((r) => classifyEstadoPontual(r.status));
  if (estados.includes("em_producao")) return "em_producao";
  if (estados.includes("cancelado")) return "cancelado";
  return "concluido";
}

/**
 * Entrega "real"/em curso que conta para o LT-span do pontual: entregue, ativo
 * ou pausado. Exclui pré-entrega (triagem/onboarding) e não-entregas
 * (cancelado/inativo, não usar). Definição do usuário p/ "tempo entre entregas".
 */
export function isEntregaElegivel(status: string | null): boolean {
  const s = (status ?? "").trim().toLowerCase();
  return s === "entregue" || s === "ativo" || s === "pausado";
}

export function buildUnitsPontual(
  rows: RawRow[], unidade: "cliente" | "contrato", hoje: string,
): Unit[] {
  if (unidade === "contrato") {
    return rows.map((r) => ({
      estado: classifyEstadoPontual(r.status),
      lt: 0,            // 1 contrato pontual não tem span
      nEntregas: 1,
      ltv: r.valorp ?? 0,
      idadeMeses: r.dataInicio ? mesesEntre(r.dataInicio, hoje) : 0,
    }));
  }
  const byCli = new Map<string, RawRow[]>();
  for (const r of rows) {
    const k = r.idTask ?? r.idSubtask ?? "";
    (byCli.get(k) ?? byCli.set(k, []).get(k)!).push(r);
  }
  const units: Unit[] = [];
  for (const [, items] of Array.from(byCli.entries())) {
    // LT do pontual = tempo entre a 1ª e a última ENTREGA elegível (entregue/
    // ativo/pausado); exclui triagem/onboarding (pré-entrega) e cancelado/não
    // usar. ~0 quando há uma única entrega; null quando não há entrega elegível.
    const datasEntrega = items
      .filter((r) => isEntregaElegivel(r.status))
      .map((r) => r.dataInicio)
      .filter((d): d is string => !!d)
      .sort();
    const lt = datasEntrega.length
      ? mesesEntre(datasEntrega[0], datasEntrega[datasEntrega.length - 1])
      : null;
    // Idade = 1ª compra (qualquer status) → hoje.
    const inicios = items.map((r) => r.dataInicio).filter((d): d is string => !!d).sort();
    const ini = inicios[0] ?? null;
    units.push({
      estado: estadoClientePontual(items),
      lt,
      nEntregas: items.length,
      ltv: items.reduce((s, r) => s + (r.valorp ?? 0), 0),
      idadeMeses: ini ? mesesEntre(ini, hoje) : 0,
    });
  }
  return units;
}

// ─── Task 3: curva de sobrevivência recorrente e recompra pontual ────────────

export interface CurvaPonto { meses: number; pctSobrevivencia: number; n: number; }
export interface Recompra { totalAvulsos: number; comRecompra: number; pctRecompra: number; }

const MARCOS = [1, 3, 6, 12];

export function buildCurvaRecorrente(rows: RawRow[], hoje: string): CurvaPonto[] {
  const recs = rows.filter(
    (r) => classifyModelo(r) === "recorrente" && !r.dataInconsistente && r.dataInicio,
  );
  return MARCOS.map((m) => {
    // tiveram chance de chegar ao marco m
    const comChance = recs.filter((r) => mesesEntre(r.dataInicio!, hoje) >= m);
    // sobreviveram ao marco: ativo (continua) OU churned mas durou >= m
    const sobreviveram = comChance.filter((r) =>
      !r.isChurned ? true : (r.ltMeses ?? 0) >= m,
    );
    return {
      meses: m,
      n: comChance.length,
      pctSobrevivencia: comChance.length
        ? Math.round((sobreviveram.length / comChance.length) * 1000) / 10
        : 0,
    };
  });
}

export function buildRecompra(rows: RawRow[]): Recompra {
  const pont = rows.filter((r) => classifyModelo(r) === "pontual");
  const byCli = new Map<string, RawRow[]>();
  for (const r of pont) {
    const k = r.idTask ?? r.idSubtask ?? "";
    (byCli.get(k) ?? byCli.set(k, []).get(k)!).push(r);
  }
  let totalAvulsos = 0, comRecompra = 0;
  for (const [, items] of Array.from(byCli.entries())) {
    const temSequencia = items.some((r) => isSequenciado(r.servico));
    if (temSequencia) continue;           // só universo avulso
    totalAvulsos++;
    if (items.length >= 2) comRecompra++;
  }
  return {
    totalAvulsos,
    comRecompra,
    pctRecompra: totalAvulsos ? Math.round((comRecompra / totalAvulsos) * 1000) / 10 : 0,
  };
}

export function aggregateMetricas(units: Unit[]): Metricas {
  const lts = units.map((u) => u.lt).filter((x): x is number => x != null);
  const ltvs = units.map((u) => u.ltv);
  const ents = units.map((u) => u.nEntregas);
  const idades = units.map((u) => u.idadeMeses);
  return {
    n: units.length,
    ltMesesMedia: round1(avg(lts)),
    ltMesesMediana: round1(mediana(lts)),
    nEntregasMedia: round1(avg(ents)),
    nEntregasMediana: round1(mediana(ents)),
    ltvMedia: round0(avg(ltvs)),
    ltvMediana: round0(mediana(ltvs)),
    ltvTotal: round0(ltvs.reduce((s, x) => s + x, 0)),
    idadeMediaMeses: round1(avg(idades)),
  };
}

// ─── Task 4: payload completo ─────────────────────────────────────────────────

export interface Grupo { modelo: Modelo; estado: string; metricas: Metricas; }

export interface CreatorsModeloPayload {
  meta: { de: string | null; ate: string | null; hoje: string; nSequenciados: number; nAvulsos: number; pctSequenciados: number; };
  tabela: { cliente: Grupo[]; contrato: Grupo[]; };
  funilVendido: FunilNivel[];
  funilEntregue: FunilNivel[];
  curvaRecorrente: CurvaPonto[];
  recompra: Recompra;
  coorte: { recorrenteIdadeMedia: number; pontualIdadeMedia: number; avisoMaturidade: boolean; };
}

/** Filtra por mês ('YYYY-MM') de data_inicio, de/ate inclusivos. */
export function aplicarPeriodo(rows: RawRow[], de?: string, ate?: string): RawRow[] {
  return rows.filter((r) => {
    const mes = r.dataInicio ? r.dataInicio.slice(0, 7) : null;
    if (de && (!mes || mes < de)) return false;
    if (ate && (!mes || mes > ate)) return false;
    return true;
  });
}

const ESTADOS_REC = ["ativo", "cancelado"] as const;
const ESTADOS_PONT = ["em_producao", "concluido", "cancelado"] as const;

function gruposDeUnidade(rows: RawRow[], unidade: "cliente" | "contrato", hoje: string): Grupo[] {
  const recRows = rows.filter((r) => classifyModelo(r) === "recorrente");
  const pontRows = rows.filter((r) => classifyModelo(r) === "pontual");
  const recUnits = buildUnitsRecorrente(recRows, unidade, hoje);
  const pontUnits = buildUnitsPontual(pontRows, unidade, hoje);

  const grupos: Grupo[] = [];
  for (const e of ESTADOS_REC) {
    grupos.push({ modelo: "recorrente", estado: e, metricas: aggregateMetricas(recUnits.filter((u) => u.estado === e)) });
  }
  grupos.push({ modelo: "recorrente", estado: "total", metricas: aggregateMetricas(recUnits) });
  for (const e of ESTADOS_PONT) {
    grupos.push({ modelo: "pontual", estado: e, metricas: aggregateMetricas(pontUnits.filter((u) => u.estado === e)) });
  }
  grupos.push({ modelo: "pontual", estado: "total", metricas: aggregateMetricas(pontUnits) });
  return grupos;
}

/** Converte RawRow (view) para o RawRow do funil de entregas (churnPontorrente). */
function toPontRows(rows: RawRow[]): PontRawRow[] {
  return rows
    .filter((r) => classifyModelo(r) === "pontual")
    .map((r) => ({
      idTask: r.idTask,
      produto: r.produto,
      servico: r.servico ?? "",
      status: r.status,
      valorp: r.valorp,
      squad: null, responsavel: null, csResponsavel: null, vendedor: null,
      motivoCancelamento: null,
      dataInicio: r.dataInicio,
      dataEncerramento: r.dataFim,
      nomeCliente: null,
    }));
}

// ─── Task 2 (redesign): LTV maduro e Placar ──────────────────────────────────

export interface LtvMaduro {
  realizadoBlended: number;
  realizadoAtivo: number;
  projetadoChurn: number;
  premissaChurnMeses: number;
}

export function buildLtvMaduro(rows: RawRow[], hoje: string): LtvMaduro {
  const rec = rows.filter((r) => classifyModelo(r) === "recorrente");
  const cli = buildUnitsRecorrente(rec, "cliente", hoje);
  const blended = aggregateMetricas(cli);
  const ativos = cli.filter((u) => u.estado === "ativo");
  const realizadoAtivo = aggregateMetricas(ativos).ltvMedia;
  const mrrAtivo = (() => {
    const v = rec.filter((r) => classifyEstadoRecorrente(r) === "ativo" && r.valorr > 0).map((r) => r.valorr);
    return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : 0;
  })();
  const ltCancelados = rec
    .filter((r) => classifyEstadoRecorrente(r) === "cancelado" && !r.dataInconsistente && r.ltMeses != null)
    .map((r) => r.ltMeses!);
  const premissaChurnMeses = ltCancelados.length
    ? Math.round((ltCancelados.reduce((s, x) => s + x, 0) / ltCancelados.length) * 10) / 10
    : 0;
  return {
    realizadoBlended: blended.ltvMedia,
    realizadoAtivo,
    projetadoChurn: Math.round(mrrAtivo * premissaChurnMeses),
    premissaChurnMeses,
  };
}

export interface BreakEven {
  ticketPontual: number;
  minRecompras: number;
  maxRecompras: number;
  recompraRealPct: number;
}

export interface Placar {
  porCliente: { recorrente: number; pontual: number; recorrenteAtivo: number; razao: number };
  volume: {
    pontualReceita: number; pontualClientes: number;
    recorrenteRealizado: number; recorrenteMrrCorrente: number; recorrenteClientes: number;
  };
  breakEven: BreakEven;
}

export function buildPlacar(rows: RawRow[], hoje: string): Placar {
  const rec = rows.filter((r) => classifyModelo(r) === "recorrente");
  const pont = rows.filter((r) => classifyModelo(r) === "pontual");
  const recCli = buildUnitsRecorrente(rec, "cliente", hoje);
  const pontCli = buildUnitsPontual(pont, "cliente", hoje);
  const recAgg = aggregateMetricas(recCli);
  const pontAgg = aggregateMetricas(pontCli);
  const recAtivoAgg = aggregateMetricas(recCli.filter((u) => u.estado === "ativo"));

  const ltv = buildLtvMaduro(rows, hoje);
  const ticketsEntregue = pont.filter((r) => r.status?.trim().toLowerCase() === "entregue").map((r) => r.valorp ?? 0);
  const ticketPontual = ticketsEntregue.length
    ? Math.round(ticketsEntregue.reduce((s, x) => s + x, 0) / ticketsEntregue.length)
    : 0;
  const recompra = buildRecompra(rows);

  return {
    porCliente: {
      recorrente: recAgg.ltvMedia,
      pontual: pontAgg.ltvMedia,
      recorrenteAtivo: recAtivoAgg.ltvMedia,
      razao: pontAgg.ltvMedia ? round1(recAgg.ltvMedia / pontAgg.ltvMedia) : 0,
    },
    volume: {
      pontualReceita: Math.round(pont.reduce((s, r) => s + (r.valorp ?? 0), 0)),
      pontualClientes: pontCli.length,
      recorrenteRealizado: Math.round(rec.reduce((s, r) => s + (r.ltvRecorrente ?? 0), 0)),
      recorrenteMrrCorrente: Math.round(
        rec.filter((r) => classifyEstadoRecorrente(r) === "ativo").reduce((s, r) => s + (r.valorr ?? 0), 0),
      ),
      recorrenteClientes: recCli.length,
      recorrenteClientesAtivos: recAtivoAgg.n,
    },
    breakEven: {
      ticketPontual,
      minRecompras: ticketPontual ? round1(ltv.realizadoBlended / ticketPontual) : 0,
      maxRecompras: ticketPontual ? round1(ltv.realizadoAtivo / ticketPontual) : 0,
      recompraRealPct: recompra.pctRecompra,
    },
  };
}

// ─── Task 3 (redesign): Mix de receita mensal por modelo ─────────────────────

export interface MixMes {
  mes: string; pontualN: number; pontualValor: number; recorrenteN: number; recorrenteMrrNovo: number;
}

export function buildMixMensal(rows: RawRow[]): MixMes[] {
  const map = new Map<string, MixMes>();
  for (const r of rows) {
    if (!r.dataInicio) continue;
    const mes = r.dataInicio.slice(0, 7);
    const modelo = classifyModelo(r);
    if (modelo !== "pontual" && modelo !== "recorrente") continue;
    const m = map.get(mes) ?? { mes, pontualN: 0, pontualValor: 0, recorrenteN: 0, recorrenteMrrNovo: 0 };
    if (modelo === "pontual") { m.pontualN += 1; m.pontualValor += r.valorp ?? 0; }
    else if (modelo === "recorrente") { m.recorrenteN += 1; m.recorrenteMrrNovo += r.valorr ?? 0; }
    map.set(mes, m);
  }
  return Array.from(map.values())
    .map((m) => ({ ...m, pontualValor: Math.round(m.pontualValor), recorrenteMrrNovo: Math.round(m.recorrenteMrrNovo) }))
    .sort((a, b) => a.mes.localeCompare(b.mes));
}

// ─── Task 4 (redesign): Sobrevivência por safra + aviso maturidade por razão ──

export interface SafraPonto { safra: string; n: number; pctAtivo: number; }

export function buildSobrevivenciaSafra(rows: RawRow[]): SafraPonto[] {
  const rec = rows.filter((r) => classifyModelo(r) === "recorrente" && r.dataInicio);
  const map = new Map<string, { n: number; ativos: number }>();
  for (const r of rec) {
    const safra = r.dataInicio!.slice(0, 7);
    const cur = map.get(safra) ?? { n: 0, ativos: 0 };
    cur.n += 1;
    if (classifyEstadoRecorrente(r) === "ativo") cur.ativos += 1;
    map.set(safra, cur);
  }
  return Array.from(map.entries())
    .map(([safra, v]) => ({ safra, n: v.n, pctAtivo: v.n ? Math.round((v.ativos / v.n) * 1000) / 10 : 0 }))
    .sort((a, b) => a.safra.localeCompare(b.safra));
}

export function avisoMaturidadePorRazao(
  rows: RawRow[], hoje: string,
): { recorrenteIdade: number; pontualIdade: number; aviso: boolean } {
  const rec = rows.filter((r) => classifyModelo(r) === "recorrente");
  const pont = rows.filter((r) => classifyModelo(r) === "pontual");
  const recIdade = aggregateMetricas(buildUnitsRecorrente(rec, "cliente", hoje)).idadeMediaMeses;
  const pontIdade = aggregateMetricas(buildUnitsPontual(pont, "cliente", hoje)).idadeMediaMeses;
  const maior = Math.max(recIdade, pontIdade), menor = Math.min(recIdade, pontIdade);
  return { recorrenteIdade: recIdade, pontualIdade: pontIdade, aviso: menor > 0 && maior / menor > 1.4 };
}

// ─── Task 5: novo payload do redesign ────────────────────────────────────────

export interface RedesignPayload {
  meta: { de: string | null; ate: string | null; hoje: string; nSequenciados: number; nAvulsos: number; pctSequenciados: number };
  placar: Placar;
  ltvMaduro: LtvMaduro;
  mixMensal: MixMes[];
  retencao: { funilVendido: FunilNivel[]; funilEntregue: FunilNivel[]; safra: SafraPonto[]; recompra: Recompra };
  maturidade: { recorrenteIdade: number; pontualIdade: number; aviso: boolean };
  // Tabela detalhada (aba "Tabela LT/LTV"): grupos por modelo/estado nas duas unidades.
  tabela: { cliente: Grupo[]; contrato: Grupo[] };
}

export function buildRedesignPayload(
  rows: RawRow[], opts: { de?: string; ate?: string; hoje: string },
): RedesignPayload {
  const { de, ate, hoje } = opts;
  const periodo = aplicarPeriodo(rows, de, ate); // bug #2: período em TUDO

  // cobertura sequenciado/avulso (reusa lógica existente)
  const pontRows = periodo.filter((r) => classifyModelo(r) === "pontual");
  const seqCli = new Set<string>(), avuCli = new Set<string>();
  const byCli = new Map<string, RawRow[]>();
  for (const r of pontRows) {
    const k = r.idTask ?? r.idSubtask ?? "";
    (byCli.get(k) ?? byCli.set(k, []).get(k)!).push(r);
  }
  for (const [k, items] of Array.from(byCli.entries())) {
    if (items.some((r) => isSequenciado(r.servico))) seqCli.add(k); else avuCli.add(k);
  }
  const pontParaFunil = toPontRows(periodo.filter((r) => classifyModelo(r) === "pontual"));
  const mat = avisoMaturidadePorRazao(periodo, hoje);

  return {
    meta: {
      de: de ?? null, ate: ate ?? null, hoje,
      nSequenciados: seqCli.size, nAvulsos: avuCli.size,
      pctSequenciados: (seqCli.size + avuCli.size) ? Math.round((seqCli.size / (seqCli.size + avuCli.size)) * 1000) / 10 : 0,
    },
    placar: buildPlacar(periodo, hoje),
    ltvMaduro: buildLtvMaduro(periodo, hoje),
    mixMensal: buildMixMensal(periodo),
    retencao: {
      funilVendido: buildFunil(toJornadas(pontParaFunil, "vendido")),
      funilEntregue: buildFunil(toJornadas(pontParaFunil, "entregue")),
      safra: buildSobrevivenciaSafra(periodo),
      recompra: buildRecompra(periodo),
    },
    maturidade: mat,
    tabela: {
      cliente: gruposDeUnidade(periodo, "cliente", hoje),
      contrato: gruposDeUnidade(periodo, "contrato", hoje),
    },
  };
}

export function buildCreatorsModeloPayload(
  rows: RawRow[], opts: { de?: string; ate?: string; hoje: string },
): CreatorsModeloPayload {
  const { de, ate, hoje } = opts;
  const periodo = aplicarPeriodo(rows, de, ate);

  const pontRows = periodo.filter((r) => classifyModelo(r) === "pontual");
  const seqCli = new Set<string>(), avuCli = new Set<string>();
  {
    const byCli = new Map<string, RawRow[]>();
    for (const r of pontRows) {
      const k = r.idTask ?? r.idSubtask ?? "";
      (byCli.get(k) ?? byCli.set(k, []).get(k)!).push(r);
    }
    for (const [k, items] of Array.from(byCli.entries())) {
      if (items.some((r) => isSequenciado(r.servico))) seqCli.add(k); else avuCli.add(k);
    }
  }

  const pontParaFunil = toPontRows(pontRows.filter((r) => isSequenciado(r.servico)));

  const recUnitsCli = buildUnitsRecorrente(periodo.filter((r) => classifyModelo(r) === "recorrente"), "cliente", hoje);
  const pontUnitsCli = buildUnitsPontual(pontRows, "cliente", hoje);
  const recIdade = aggregateMetricas(recUnitsCli).idadeMediaMeses;
  const pontIdade = aggregateMetricas(pontUnitsCli).idadeMediaMeses;

  return {
    meta: {
      de: de ?? null, ate: ate ?? null, hoje,
      nSequenciados: seqCli.size,
      nAvulsos: avuCli.size,
      pctSequenciados: (seqCli.size + avuCli.size)
        ? Math.round((seqCli.size / (seqCli.size + avuCli.size)) * 1000) / 10 : 0,
    },
    tabela: {
      cliente: gruposDeUnidade(periodo, "cliente", hoje),
      contrato: gruposDeUnidade(periodo, "contrato", hoje),
    },
    funilVendido: buildFunil(toJornadas(pontParaFunil, "vendido")),
    funilEntregue: buildFunil(toJornadas(pontParaFunil, "entregue")),
    curvaRecorrente: buildCurvaRecorrente(periodo, hoje),
    recompra: buildRecompra(periodo),
    coorte: {
      recorrenteIdadeMedia: recIdade,
      pontualIdadeMedia: pontIdade,
      avisoMaturidade: Math.abs(recIdade - pontIdade) > 6,
    },
  };
}

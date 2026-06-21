// server/routes/creatorsModelo.helpers.ts
import { extractNivelEntrega } from "./churnPontorrente.helpers";
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

/** Recorrente: 2 estados. Churned = cancelado; o resto = ativo. */
export function classifyEstadoRecorrente(r: RawRow): EstadoRec {
  return r.isChurned ? "cancelado" : "ativo";
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
    return rows.map((r) => ({
      estado: classifyEstadoRecorrente(r),
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
    const ativo = items.some((r) => !r.isChurned);
    const inicios = items.map((r) => r.dataInicio).filter((d): d is string => !!d).sort();
    const fins = items.map((r) => r.dataFim).filter((d): d is string => !!d).sort();
    const ini = inicios[0] ?? null;
    let lt: number | null = null;
    if (ini) {
      const fim = ativo ? hoje : (fins[fins.length - 1] ?? null);
      lt = fim ? mesesEntre(ini, fim) : null;
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
    const inicios = items.map((r) => r.dataInicio).filter((d): d is string => !!d).sort();
    const ini = inicios[0] ?? null;
    const ult = inicios[inicios.length - 1] ?? null;
    units.push({
      estado: estadoClientePontual(items),
      lt: ini && ult ? mesesEntre(ini, ult) : 0,
      nEntregas: items.length,
      ltv: items.reduce((s, r) => s + (r.valorp ?? 0), 0),
      idadeMeses: ini ? mesesEntre(ini, hoje) : 0,
    });
  }
  return units;
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

// server/routes/creatorsModelo.helpers.ts
import { extractNivelEntrega } from "./churnPontorrente.helpers";

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
